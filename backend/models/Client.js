import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientGroup',
    required: true
  },
  status: {
    type: String,
    enum: ['Individual', 'Firm', 'Company', 'Others'],
    required: true
  },
  workOffered: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkType',
    required: true
  }],
  priority: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: true,
    default: 'A',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Client', clientSchema); 