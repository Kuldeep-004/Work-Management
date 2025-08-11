import mongoose from 'mongoose';

const customColumnSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'checkbox', 'tags'],
    required: true
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  options: {
    type: [String], // For tags type - predefined options
    default: []
  },
  order: {
    type: Number,
    default: 1000 // Custom columns start from order 1000
  },
  isActive: {
    type: Boolean,
    default: true
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
customColumnSchema.index({ order: 1 });
customColumnSchema.index({ isActive: 1 });
customColumnSchema.index({ name: 1 }, { unique: true });

export default mongoose.model('CustomColumn', customColumnSchema);
