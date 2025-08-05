import express from 'express';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadChatFileMiddleware } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Get messages for a specific chat
router.get('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.user': userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const messages = await Message.find({
      chat: chatId,
      deletedFor: { $ne: userId }
    })
    .populate('sender', 'firstName lastName photo')
    .populate('replyTo', 'content sender type')
    .populate('readBy.user', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Mark messages as read
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: {
          readBy: { user: userId, readAt: new Date() }
        }
      }
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Send a text message
router.post('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, replyToId, type = 'text' } = req.body;
    const userId = req.user.id;

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.user': userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!content && type === 'text') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = new Message({
      chat: chatId,
      sender: userId,
      content,
      type,
      replyTo: replyToId || undefined
    });

    // Mark as delivered to all other participants
    const otherParticipants = chat.participants
      .filter(p => p.user.toString() !== userId)
      .map(p => ({ user: p.user, deliveredAt: new Date() }));
    
    message.deliveredTo = otherParticipants;

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName photo')
      .populate('replyTo', 'content sender type');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Send a file message
router.post('/:chatId/file', protect, uploadChatFileMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'File is required' });
    }

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.user': userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    let messageType = 'file';
    let duration = null;

    if (file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      messageType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      messageType = 'audio';
      // For audio files, we might want to extract duration if available
      // This is a placeholder - actual implementation would need audio processing
      duration = file.duration || null;
    }

    const message = new Message({
      chat: chatId,
      sender: userId,
      content: content || '',
      type: messageType,
      file: {
        public_id: file.public_id,
        url: file.secure_url,
        fileName: file.original_filename || `${messageType}_${Date.now()}`,
        fileSize: file.bytes,
        fileType: file.mimetype,
        duration: duration
      }
    });

    // Mark as delivered to all other participants
    const otherParticipants = chat.participants
      .filter(p => p.user.toString() !== userId)
      .map(p => ({ user: p.user, deliveredAt: new Date() }));
    
    message.deliveredTo = otherParticipants;

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName photo');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending file:', error);
    res.status(500).json({ message: 'Error sending file' });
  }
});

// Edit a message
router.put('/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: messageId,
      sender: userId,
      type: 'text'
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found or cannot be edited' });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate('sender', 'firstName lastName photo');

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Error editing message' });
  }
});

// Delete a message
router.delete('/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteForEveryone = false } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (deleteForEveryone && message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'Cannot delete message for everyone' });
    }

    if (deleteForEveryone) {
      message.isDeleted = true;
      message.content = 'This message was deleted';
    } else {
      message.deletedFor.push(userId);
    }

    await message.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Add reaction to message
router.post('/:messageId/react', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(r => r.user.toString() !== userId);

    // Add new reaction if emoji is provided
    if (emoji) {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate('reactions.user', 'firstName lastName');

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ message: 'Error adding reaction' });
  }
});

// Mark messages as read
router.post('/:chatId/read', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: {
          readBy: { user: userId, readAt: new Date() }
        }
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

export default router;
