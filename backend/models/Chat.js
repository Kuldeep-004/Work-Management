import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['private', 'group'],
      required: true,
    },
    name: {
      type: String,
      required: function() {
        return this.type === 'group';
      }
    },
    description: {
      type: String,
      default: '',
    },
    participants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      canAddMembers: {
        type: Boolean,
        default: false,
      },
      canRemoveMembers: {
        type: Boolean,
        default: false,
      }
    }],
    avatar: {
      public_id: String,
      url: String,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    settings: {
      muteNotifications: {
        type: Boolean,
        default: false,
      },
      muteUntil: Date,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ type: 1 });
chatSchema.index({ isActive: 1 });

// Ensure private chats have exactly 2 participants
chatSchema.pre('save', function(next) {
  if (this.type === 'private' && this.participants.length !== 2) {
    return next(new Error('Private chat must have exactly 2 participants'));
  }
  next();
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
