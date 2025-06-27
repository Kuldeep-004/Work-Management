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
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['today', 'lessThan3Days', 'thisWeek', 'thisMonth', 'regular', 'filed', 'dailyWorksOffice', 'monthlyWorks'],
    default: 'regular'
  },
  inwardEntryDate: {
    type: Date,
    required: true
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
  verificationStatus: {
    type: String,
    enum: ['pending','executed', 'first_verified','completed', 'rejected'],
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
  }]
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema); 