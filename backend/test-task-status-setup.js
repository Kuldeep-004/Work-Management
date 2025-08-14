import mongoose from 'mongoose';
import TaskStatus from './models/TaskStatus.js';

const validateTaskStatusSetup = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/work-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    
    // Check existing task statuses
    const statuses = await TaskStatus.find({ isActive: true }).sort({ order: 1 });
    console.log('\n=== Current Task Statuses ===');
    statuses.forEach(status => {
      console.log(`✓ ${status.name}`);
      console.log(`  - Color: ${status.color}`);
      console.log(`  - Order: ${status.order}`);
      console.log(`  - Default: ${status.isDefault}`);
      console.log('');
    });
    
    // Test creating a custom status
    console.log('=== Testing Custom Status Creation ===');
    const testStatus = {
      name: 'review',
      color: 'bg-purple-100 text-purple-800',
      isDefault: false,
      order: 10,
      isActive: true
    };
    
    // Check if already exists
    const existing = await TaskStatus.findOne({ name: testStatus.name });
    if (existing) {
      console.log(`Custom status '${testStatus.name}' already exists`);
    } else {
      await TaskStatus.create(testStatus);
      console.log(`✓ Created custom status '${testStatus.name}'`);
    }
    
    // Final count
    const finalStatuses = await TaskStatus.find({ isActive: true }).sort({ order: 1 });
    console.log(`\n=== Summary ===`);
    console.log(`Total active statuses: ${finalStatuses.length}`);
    console.log('Available for dropdown:');
    finalStatuses.forEach(s => {
      console.log(`  - ${s.name} (${s.color})`);
    });
    
    console.log('\nExcluding completed for automation tasks:');
    const automationStatuses = finalStatuses.filter(s => s.name !== 'completed');
    automationStatuses.forEach(s => {
      console.log(`  - ${s.name} (${s.color})`);
    });
    
    mongoose.connection.close();
    console.log('\n✓ Validation complete');
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

validateTaskStatusSetup();
