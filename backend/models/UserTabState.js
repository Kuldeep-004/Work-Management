import mongoose from 'mongoose';

const userTabStateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tabKey: {
    type: String,
    required: true,
    index: true,
  },
  state: {
    type: mongoose.Schema.Types.Mixed, // Arbitrary JSON. Can include { taskOrder: { [groupKey]: [taskId, ...] } }
    default: {},
  },
}, {
  timestamps: true,
});

userTabStateSchema.index({ user: 1, tabKey: 1 }, { unique: true });

export default mongoose.model('UserTabState', userTabStateSchema); 