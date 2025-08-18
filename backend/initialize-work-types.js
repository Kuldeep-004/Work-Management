import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WorkType from './models/WorkType.js';
import User from './models/User.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const DEFAULT_WORK_TYPES = [
  'Data Entry',
  'Analysis',
  'Review',
  'Research',
  'Documentation',
  'Testing',
  'Design',
  'Development',
  'Consultation',
  'Verification',
  'Compliance',
  'Audit',
  'Training',
  'Support'
];

async function initializeWorkTypes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find an admin user to assign as creator
    const adminUser = await User.findOne({ role: 'Admin' });
    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`Found admin user: ${adminUser.firstName} ${adminUser.lastName}`);

    // Check if work types already exist
    const existingWorkTypes = await WorkType.find();
    if (existingWorkTypes.length > 0) {
      console.log(`Found ${existingWorkTypes.length} existing work types:`);
      existingWorkTypes.forEach(wt => console.log(`  - ${wt.name}`));
      console.log('Skipping initialization. Delete existing work types first if you want to reinitialize.');
      process.exit(0);
    }

    // Create default work types
    console.log('Creating default work types...');
    const workTypesToCreate = DEFAULT_WORK_TYPES.map(name => ({
      name,
      createdBy: adminUser._id
    }));

    const createdWorkTypes = await WorkType.insertMany(workTypesToCreate);
    console.log(`Successfully created ${createdWorkTypes.length} work types:`);
    createdWorkTypes.forEach(wt => console.log(`  - ${wt.name}`));

  } catch (error) {
    console.error('Error initializing work types:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
initializeWorkTypes();
