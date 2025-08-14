import TaskStatus from './models/TaskStatus.js';
import mongoose from 'mongoose';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/work_management');

// Initialize default task statuses with proper colors
const initializeDefaultStatuses = async () => {
  const defaultStatuses = [
    { 
      name: 'yet_to_start', 
      color: 'bg-gray-100 text-gray-800', 
      isDefault: true, 
      order: 1 
    },
    { 
      name: 'in_progress', 
      color: 'bg-blue-100 text-blue-800', 
      isDefault: true, 
      order: 2 
    },
    { 
      name: 'completed', 
      color: 'bg-green-100 text-green-800', 
      isDefault: true, 
      order: 3 
    }
  ];

  console.log('Initializing default statuses...');
  
  for (const status of defaultStatuses) {
    const result = await TaskStatus.findOneAndUpdate(
      { name: status.name },
      status,
      { upsert: true, new: true }
    );
    console.log(`Status "${status.name}" updated with color: ${status.color}`);
  }
  
  // Check all statuses
  const allStatuses = await TaskStatus.find().sort({ order: 1 });
  console.log('\nAll statuses in database:');
  allStatuses.forEach(status => {
    console.log(`- Name: ${status.name}, Color: ${status.color}, isActive: ${status.isActive}, isDefault: ${status.isDefault}`);
  });
  
  mongoose.connection.close();
  console.log('\nTask statuses initialization completed!');
};

initializeDefaultStatuses().catch(console.error);
