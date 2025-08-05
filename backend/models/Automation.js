import mongoose from 'mongoose';

const automationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  triggerType: { type: String, enum: ['dayOfMonth', 'dateAndTime', 'quarterly', 'halfYearly', 'yearly'], required: true, default: 'dayOfMonth' },
  dayOfMonth: { type: Number }, // For dayOfMonth, yearly, halfYearly, quarterly
  monthOfYear: { type: Number }, // For yearly (1-12)
  quarterlyMonths: [{ type: Number }], // For quarterly: array of 4 months (one for each quarter)
  halfYearlyMonths: [{ type: Number }], // For halfYearly: array of 2 months (one for each half)
  specificDate: { type: Date },
  specificTime: { type: String }, // Time in 24-hour format (HH:MM)
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  taskTemplate: [{
    title: String,
    description: String,
    clientName: String,
    clientGroup: String,
    workType: [String],
    assignedTo: [mongoose.Schema.Types.ObjectId],
    priority: String,
    inwardEntryDate: String,
    inwardEntryTime: String,
    dueDate: String,
    targetDate: String,
    verificationAssignedTo: mongoose.Schema.Types.ObjectId,
    billed: Boolean,
    files: [{
      filename: String,
      originalName: String,
      path: String,
      cloudUrl: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now }
    }]
  }],
  createdAt: { type: Date, default: Date.now },
  lastRunDate: { type: Date }, // Track when automation was last run for the month
  lastRunMonth: { type: Number }, // Track which month the automation was last run
  lastRunYear: { type: Number }, // Track which year the automation was last run
});

export default mongoose.model('Automation', automationSchema);
