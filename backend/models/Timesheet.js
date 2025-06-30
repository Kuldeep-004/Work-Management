import mongoose from 'mongoose';

const timesheetEntrySchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: false
  },
  manualTaskName: {
    type: String,
    trim: false,
  },
  workDescription: {
    type: String,
    required: false,
    trim: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, { _id: true });

const timesheetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  entries: [timesheetEntrySchema],
  totalTimeSpent: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
timesheetSchema.index({ user: 1, date: 1 });

// Pre-save middleware to calculate total time
timesheetSchema.pre('save', function(next) {
  this.totalTimeSpent = this.entries.reduce((total, entry) => total + entry.timeSpent, 0);
  next();
});

const Timesheet = mongoose.model('Timesheet', timesheetSchema);

export default Timesheet; 