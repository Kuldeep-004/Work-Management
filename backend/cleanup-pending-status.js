import mongoose from 'mongoose';
import TaskStatus from './models/TaskStatus.js';

const removePendingStatus = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/work-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    
    // Remove pending status if it exists
    const pendingStatus = await TaskStatus.findOne({ name: 'pending' });
    if (pendingStatus) {
      await TaskStatus.deleteOne({ name: 'pending' });
      console.log('✓ Removed pending status');
    } else {
      console.log('Pending status not found');
    }
    
    // Update order numbers for remaining statuses
    await TaskStatus.findOneAndUpdate({ name: 'yet_to_start' }, { order: 1 });
    await TaskStatus.findOneAndUpdate({ name: 'in_progress' }, { order: 2 });
    await TaskStatus.findOneAndUpdate({ name: 'completed' }, { order: 3 });
    
    console.log('✓ Updated status order numbers');
    
    // Show final statuses
    const finalStatuses = await TaskStatus.find({ isActive: true }).sort({ order: 1 });
    console.log('\n=== Final Task Statuses ===');
    finalStatuses.forEach(status => {
      console.log(`${status.name} - Order: ${status.order} - ${status.color}`);
    });
    
    mongoose.connection.close();
    console.log('\n✓ Cleanup complete');
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

removePendingStatus();
