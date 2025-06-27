import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  user: {
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
  dueDate: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model('Todo', todoSchema); 