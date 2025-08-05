import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientGroup: {
    type: String,
    required: true,
    trim: true
  },
  workType: [{
    type: String,
    required: true,
    trim: true
  }],
  billed: {
    type: Boolean,
    default: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: [ 'yet_to_start', 'in_progress', 'completed'],
    default: 'yet_to_start'
  },
  priority: {
    type: String,
    required: true,
    default: 'regular'
  },
  inwardEntryDate: {
    type: Date,
  },
  dueDate: {
    type: Date,
  },
  targetDate: {
    type: Date,
  },
  verificationAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  secondVerificationAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  thirdVerificationAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fourthVerificationAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fifthVerificationAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationStatus: {
    type: String,
    enum: ['pending','completed'],
    default: 'pending'
  },
  originalAssignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  files: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    cloudUrl: {
      type: String
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    type: {
      type: String,
      enum: ['text', 'audio'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    audioUrl: {
      type: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  selfVerification: {
    type: Boolean,
    default: false
  },
  verification: {
    type: String,
    enum: ['pending', 'rejected', 'accepted', 'next verification'],
    default: 'pending'
  },
  guides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema); 