import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadChatAvatarMiddleware } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Get all chats for the authenticated user - WhatsApp level optimization
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query; // Add pagination for large chat lists
    
    const skip = (page - 1) * limit;
    
    const chats = await Chat.find({
      'participants.user': userId,
      isActive: true
    })
    .populate({
      path: 'participants.user',
      select: 'firstName lastName email photo isOnline lastSeen'
    })
    .populate({
      path: 'lastMessage',
      select: 'content type createdAt file.fileName', // Only select needed fields
      populate: {
        path: 'sender',
        select: 'firstName lastName'
      }
    })
    .select('type name description participants avatar lastMessage lastActivity unreadCounts settings')
    .sort({ lastActivity: -1 })
    .limit(limit)
    .skip(skip)
    .lean(); // Use lean() for better performance

    // Add unread count for current user using stored counts
    const chatsWithUnreadCount = chats.map(chat => {
      const unreadCountObj = chat.unreadCounts?.find(uc => uc.user.toString() === userId);
      return {
        ...chat,
        unreadCount: unreadCountObj?.count || 0
      };
    });

    res.json(chatsWithUnreadCount);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

// Create a new private chat
router.post('/private', protect, async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.id;

    if (!participantId || participantId === userId) {
      return res.status(400).json({ message: 'Invalid participant ID' });
    }

    // Check if private chat already exists
    const existingChat = await Chat.findOne({
      type: 'private',
      'participants.user': { $all: [userId, participantId] }
    });

    if (existingChat) {
      return res.json(existingChat);
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create new private chat
    const chat = new Chat({
      type: 'private',
      participants: [
        { user: userId, role: 'member' },
        { user: participantId, role: 'member' }
      ],
      createdBy: userId
    });

    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.status(201).json(populatedChat);
  } catch (error) {
    console.error('Error creating private chat:', error);
    res.status(500).json({ message: 'Error creating private chat' });
  }
});

// Create a new group chat (Admin only)
router.post('/group', protect, async (req, res) => {
  try {
    const { name, description, participantIds } = req.body;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can create groups.' });
    }

    if (!name || !participantIds || participantIds.length < 1) {
      return res.status(400).json({ message: 'Group name and at least one participant required' });
    }

    // Verify all participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      return res.status(400).json({ message: 'Some participants not found' });
    }

    // Create group chat
    const chat = new Chat({
      type: 'group',
      name,
      description: description || '',
      participants: [
        { user: userId, role: 'admin' },
        ...participantIds.map(id => ({ user: id, role: 'member' }))
      ],
      createdBy: userId
    });

    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.status(201).json(populatedChat);
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({ message: 'Error creating group chat' });
  }
});

// Get chat by ID
router.get('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      'participants.user': userId
    })
    .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Error fetching chat' });
  }
});

// Update group chat
router.put('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group',
      'participants': { $elemMatch: { user: userId, role: 'admin' } }
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found or insufficient permissions' });
    }

    if (name) chat.name = name;
    if (description !== undefined) chat.description = description;

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error updating group chat:', error);
    res.status(500).json({ message: 'Error updating group chat' });
  }
});

// Add participant to group (System Admin only)
router.post('/:chatId/participants', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { participantIds } = req.body;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can add participants to groups.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify participants exist and aren't already in the group
    const existingParticipantIds = chat.participants.map(p => p.user.toString());
    const newParticipantIds = participantIds.filter(id => !existingParticipantIds.includes(id));

    if (newParticipantIds.length === 0) {
      return res.status(400).json({ message: 'All users are already participants' });
    }

    const newParticipants = await User.find({ _id: { $in: newParticipantIds } });
    if (newParticipants.length !== newParticipantIds.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }

    // Add new participants
    chat.participants.push(...newParticipantIds.map(id => ({ user: id, role: 'member' })));
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error adding participants:', error);
    res.status(500).json({ message: 'Error adding participants' });
  }
});

// Remove participant from group (System Admin only)
router.delete('/:chatId/participants/:participantId', protect, async (req, res) => {
  try {
    const { chatId, participantId } = req.params;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can remove participants from groups.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Admins have full control - can remove anyone including creators

    // Remove participant
    chat.participants = chat.participants.filter(p => p.user.toString() !== participantId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ message: 'Error removing participant' });
  }
});

// Leave group
router.post('/:chatId/leave', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group',
      'participants.user': userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // If user is the creator, transfer ownership to another admin or member
    if (chat.createdBy.toString() === userId) {
      const otherAdmins = chat.participants.filter(p => 
        p.user.toString() !== userId && p.role === 'admin'
      );
      
      if (otherAdmins.length > 0) {
        chat.createdBy = otherAdmins[0].user;
      } else {
        const otherMembers = chat.participants.filter(p => p.user.toString() !== userId);
        if (otherMembers.length > 0) {
          chat.createdBy = otherMembers[0].user;
          // Promote the new owner to admin
          chat.participants.find(p => p.user.toString() === otherMembers[0].user.toString()).role = 'admin';
        } else {
          // If no other members, deactivate the group
          chat.isActive = false;
        }
      }
    }

    // Remove user from participants
    chat.participants = chat.participants.filter(p => p.user.toString() !== userId);
    await chat.save();

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ message: 'Error leaving group' });
  }
});

// Update group name (System Admin only)
router.put('/:chatId/name', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can update group names.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    chat.name = name.trim();
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error updating group name:', error);
    res.status(500).json({ message: 'Error updating group name' });
  }
});

// Update group avatar (System Admin only)
router.put('/:chatId/avatar', protect, uploadChatAvatarMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can update group avatars.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found or insufficient permissions' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    chat.avatar = {
      public_id: req.file.public_id,
      url: req.file.secure_url
    };

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error updating group avatar:', error);
    res.status(500).json({ message: 'Error updating group avatar' });
  }
});

// Add members to group (System Admin only)
router.post('/:chatId/members', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userIds } = req.body;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can add members to groups.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify users exist and aren't already in the group
    const existingParticipantIds = chat.participants.map(p => p.user.toString());
    const newUserIds = userIds.filter(id => !existingParticipantIds.includes(id));

    if (newUserIds.length === 0) {
      return res.status(400).json({ message: 'All users are already participants' });
    }

    const newUsers = await User.find({ _id: { $in: newUserIds } });
    if (newUsers.length !== newUserIds.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }

    // Add new participants
    chat.participants.push(...newUserIds.map(id => ({ user: id, role: 'member' })));
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(500).json({ message: 'Error adding members' });
  }
});

// Remove member from group (System Admin only)
router.delete('/:chatId/members/:memberId', protect, async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can remove members from groups.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Don't allow removing the creator (but admin can remove creator if needed)
    // Admins have full control over groups

    // Remove participant
    chat.participants = chat.participants.filter(p => p.user.toString() !== memberId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: 'Error removing member' });
  }
});

// Promote/demote member admin status (System Admin only)
router.put('/:chatId/admin', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId: targetUserId, action } = req.body; // action: 'promote' or 'demote'
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can manage group admin status.' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const targetParticipant = chat.participants.find(p => p.user.toString() === targetUserId);
    if (!targetParticipant) {
      return res.status(404).json({ message: 'User not found in group' });
    }

    if (action === 'promote') {
      targetParticipant.role = 'admin';
    } else if (action === 'demote') {
      // System admins can demote anyone, including creators
      targetParticipant.role = 'member';
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants.user', 'firstName lastName email photo isOnline lastSeen');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ message: 'Error updating admin status' });
  }
});

// Get all users for chat creation
router.get('/users/all', protect, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.id }, status: 'approved' },
      'firstName lastName email photo isOnline lastSeen'
    ).sort({ firstName: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Delete entire group (System Admin only)
router.delete('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check if user is system admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only system admins can delete groups.' });
    }

    // Find the group chat
    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Delete all messages in this chat
    const Message = (await import('../models/Message.js')).default;
    await Message.deleteMany({ chat: chatId });

    // Delete the chat itself
    await Chat.findByIdAndDelete(chatId);

    res.json({ message: 'Group and all messages deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Error deleting group' });
  }
});

export default router;
