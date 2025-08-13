import mongoose from 'mongoose';
import TaskStatus from '../models/TaskStatus.js';
import Task from '../models/Task.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/work-management';

const migrateTaskStatuses = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all existing task statuses
    const existingStatuses = await TaskStatus.find();
    console.log(`Found ${existingStatuses.length} existing task statuses`);

    // Update each status to use name as the display value
    for (const status of existingStatuses) {
      // Use the label as the new name if it exists, otherwise keep the current name
      const newName = status.label || status.name;
      
      // Update the task status
      await TaskStatus.findByIdAndUpdate(status._id, {
        name: newName,
        $unset: { label: 1 }  // Remove the label field
      });

      // Update any tasks that reference this status by the old name format
      if (status.name !== newName) {
        await Task.updateMany(
          { status: status.name },
          { status: newName }
        );
        console.log(`Updated tasks from status "${status.name}" to "${newName}"`);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

migrateTaskStatuses();
