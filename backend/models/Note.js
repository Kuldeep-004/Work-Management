import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure one note per user
noteSchema.index({ userId: 1 }, { unique: true });

const Note = mongoose.model('Note', noteSchema);
export default Note;