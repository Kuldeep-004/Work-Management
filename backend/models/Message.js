import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: function() {
        return !this.file && this.type === 'text';
      }
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video', 'system'],
      default: 'text',
    },
    file: {
      public_id: String,
      url: String,
      fileName: String,
      fileSize: Number,
      fileType: String,
      duration: Number, // for audio/video files
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      readAt: {
        type: Date,
        default: Date.now,
      }
    }],
    deliveredTo: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      deliveredAt: {
        type: Date,
        default: Date.now,
      }
    }],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      emoji: String,
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }],
    metadata: {
      mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
      links: [String],
      location: {
        latitude: Number,
        longitude: Number,
        address: String,
      }
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ createdAt: -1 });

// Update chat's lastMessage and lastActivity when message is saved
messageSchema.post('save', async function() {
  await mongoose.model('Chat').findByIdAndUpdate(
    this.chat,
    {
      lastMessage: this._id,
      lastActivity: this.createdAt,
    }
  );
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
