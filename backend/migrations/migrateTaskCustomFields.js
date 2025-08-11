import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Task from '../models/Task.js';
import CustomColumn from '../models/CustomColumn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function migrateTaskCustomFields() {
  try {
    // Connect to MongoDB (same as server.js)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/haacas13');
    console.log('Connected to MongoDB');

    // Get all active custom columns
    const customColumns = await CustomColumn.find({ isActive: true });
    console.log(`Found ${customColumns.length} active custom columns`);

    if (customColumns.length === 0) {
      console.log('No custom columns found, nothing to migrate');
      return;
    }

    // Get all tasks that don't have customFields or have empty customFields
    const tasks = await Task.find({
      $or: [
        { customFields: { $exists: false } },
        { customFields: {} },
        { customFields: null }
      ]
    });

    console.log(`Found ${tasks.length} tasks to update`);

    let updatedCount = 0;

    // Update each task with default custom field values
    for (const task of tasks) {
      const customFields = {};
      
      // Set default values for all active custom columns
      for (const column of customColumns) {
        if (!task.customFields || !task.customFields.hasOwnProperty(column.name)) {
          customFields[column.name] = column.defaultValue;
        }
      }

      if (Object.keys(customFields).length > 0) {
        task.customFields = { ...task.customFields, ...customFields };
        await task.save();
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} tasks with default custom field values`);
    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTaskCustomFields();
}

export default migrateTaskCustomFields;
