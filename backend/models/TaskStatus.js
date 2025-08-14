import mongoose from 'mongoose';

const taskStatusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    default: 'bg-gray-100 text-gray-800'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual to get hex color from Tailwind class
taskStatusSchema.virtual('hexColor').get(function() {
  const tailwindToHex = {
    'bg-red-100 text-red-800': '#EF4444',
    'bg-yellow-100 text-yellow-800': '#F59E0B',
    'bg-green-100 text-green-800': '#10B981',
    'bg-blue-100 text-blue-800': '#3B82F6',
    'bg-indigo-100 text-indigo-800': '#6366F1',
    'bg-purple-100 text-purple-800': '#8B5CF6',
    'bg-pink-100 text-pink-800': '#EC4899',
    'bg-orange-100 text-orange-800': '#F97316',
    'bg-teal-100 text-teal-800': '#14B8A6',
    'bg-cyan-100 text-cyan-800': '#06B6D4',
    'bg-gray-100 text-gray-800': '#6B7280'
  };
  
  // If it's already a hex color, return it
  if (this.color && this.color.startsWith('#')) {
    return this.color;
  }
  
  // Otherwise, convert from Tailwind to hex
  return tailwindToHex[this.color] || '#6B7280';
});

// Ensure virtual fields are serialized
taskStatusSchema.set('toJSON', { virtuals: true });
taskStatusSchema.set('toObject', { virtuals: true });

export default mongoose.model('TaskStatus', taskStatusSchema);
