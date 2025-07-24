import mongoose from 'mongoose';

const prioritySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 100 // Custom priorities start from order 100
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isDefault;
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying
prioritySchema.index({ order: 1 });
prioritySchema.index({ isDefault: 1 });

export default mongoose.model('Priority', prioritySchema);
