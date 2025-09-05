import mongoose from 'mongoose';

const prioritySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    default: 'bg-gray-100 text-gray-800 border border-gray-200'
  },
  order: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
prioritySchema.index({ order: 1 });

export default mongoose.model('Priority', prioritySchema);
