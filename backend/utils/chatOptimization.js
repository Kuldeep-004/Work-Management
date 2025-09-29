// Chat optimization utilities for WhatsApp-level performance

import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

/**
 * Efficiently update unread counts for multiple users
 * @param {string} chatId - The chat ID
 * @param {string} senderId - The sender's user ID  
 * @param {Array} participantIds - Array of participant user IDs to update
 */
export const updateUnreadCounts = async (chatId, senderId, participantIds = null) => {
  try {
    let targetParticipants = participantIds;
    
    if (!targetParticipants) {
      // Get participants from chat if not provided
      const chat = await Chat.findById(chatId).select('participants').lean();
      if (!chat) return;
      
      targetParticipants = chat.participants
        .filter(p => p.user.toString() !== senderId)
        .map(p => p.user);
    }

    if (targetParticipants.length === 0) return;

    // Batch operations for better performance
    const bulkOps = targetParticipants.map(participantId => ({
      updateOne: {
        filter: { 
          _id: chatId,
          'unreadCounts.user': participantId 
        },
        update: { 
          $inc: { 'unreadCounts.$.count': 1 } 
        }
      }
    }));

    // Add operations for users without existing unread count entries
    const addUnreadCountOps = targetParticipants.map(participantId => ({
      updateOne: {
        filter: { 
          _id: chatId,
          'unreadCounts.user': { $ne: participantId }
        },
        update: { 
          $push: { 
            unreadCounts: { user: participantId, count: 1 } 
          } 
        }
      }
    }));

    await Chat.bulkWrite([...bulkOps, ...addUnreadCountOps]);
  } catch (error) {
    console.error('Error updating unread counts:', error);
  }
};

/**
 * Reset unread count for a specific user in a chat
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID
 */
export const resetUnreadCount = async (chatId, userId) => {
  try {
    await Chat.updateOne(
      { 
        _id: chatId,
        'unreadCounts.user': userId 
      },
      { 
        $set: { 'unreadCounts.$.count': 0 } 
      }
    );
  } catch (error) {
    console.error('Error resetting unread count:', error);
  }
};

/**
 * Get optimized chat list for a user with pagination
 * @param {string} userId - The user ID
 * @param {number} page - Page number
 * @param {number} limit - Number of chats per page
 */
export const getOptimizedChats = async (userId, page = 1, limit = 50) => {
  try {
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
      select: 'content type createdAt file.fileName',
      populate: {
        path: 'sender',
        select: 'firstName lastName'
      }
    })
    .select('type name description participants avatar lastMessage lastActivity unreadCounts settings')
    .sort({ lastActivity: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

    // Add unread count for current user
    const chatsWithUnreadCount = chats.map(chat => {
      const unreadCountObj = chat.unreadCounts?.find(uc => uc.user.toString() === userId);
      return {
        ...chat,
        unreadCount: unreadCountObj?.count || 0
      };
    });

    return chatsWithUnreadCount;
  } catch (error) {
    console.error('Error getting optimized chats:', error);
    return [];
  }
};

/**
 * Get messages with cursor-based pagination for better performance
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID (for verification)
 * @param {number} limit - Number of messages to fetch
 * @param {string} before - Cursor for pagination (ISO date string)
 */
export const getOptimizedMessages = async (chatId, userId, limit = 30, before = null) => {
  try {
    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.user': userId
    }).select('_id').lean();

    if (!chat) {
      throw new Error('Chat not found or user not authorized');
    }

    let query = {
      chat: chatId,
      deletedFor: { $ne: userId }
    };

    // Cursor-based pagination
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'firstName lastName photo')
      .populate('replyTo', 'content sender type')
      .select('chat sender content type file replyTo isEdited editedAt readBy createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    return {
      messages: messages.reverse(),
      hasMore: messages.length === parseInt(limit),
      nextCursor: messages.length > 0 ? messages[0].createdAt : null
    };
  } catch (error) {
    console.error('Error getting optimized messages:', error);
    throw error;
  }
};

/**
 * Batch mark messages as read for better performance
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID
 */
export const batchMarkMessagesAsRead = async (chatId, userId) => {
  try {
    // Get unread message IDs in batches to avoid large arrays
    const unreadMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId }
    })
    .select('_id')
    .limit(100) // Process in batches
    .lean();

    if (unreadMessages.length === 0) return;

    const messageIds = unreadMessages.map(msg => msg._id);

    // Batch update messages
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $push: {
          readBy: { user: userId, readAt: new Date() }
        }
      }
    );

    // Reset unread count
    await resetUnreadCount(chatId, userId);

    return unreadMessages.length;
  } catch (error) {
    console.error('Error batch marking messages as read:', error);
    throw error;
  }
};

/**
 * Clean up old typing states and inactive sessions
 */
export const cleanupChatSessions = () => {
  // This would be called periodically to clean up memory
  // Implementation depends on your session management
  console.log('Cleaning up chat sessions...');
};

/**
 * Cache frequently accessed chat data for better performance
 * @param {string} chatId - The chat ID
 */
export const getCachedChatInfo = async (chatId) => {
  // Implement Redis or memory caching here for frequently accessed chats
  // For now, return basic chat info
  try {
    return await Chat.findById(chatId)
      .select('type name participants avatar')
      .populate('participants.user', 'firstName lastName photo isOnline')
      .lean();
  } catch (error) {
    console.error('Error getting cached chat info:', error);
    return null;
  }
};