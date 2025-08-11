import mongoose from 'mongoose';
import Automation from '../models/Automation.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const addVerificationStatusToAutomationTemplates = async () => {
  try {
    console.log('Starting migration: Adding verificationStatus to automation task templates...');
    
    // Find all automations
    const automations = await Automation.find({});
    let updatedCount = 0;
    
    for (const automation of automations) {
      let needsUpdate = false;
      
      // Check and update each task template
      if (automation.taskTemplate && Array.isArray(automation.taskTemplate)) {
        for (const template of automation.taskTemplate) {
          if (!template.verificationStatus) {
            template.verificationStatus = 'pending';
            needsUpdate = true;
          }
        }
      }
      
      if (needsUpdate) {
        await automation.save();
        updatedCount++;
        console.log(`Updated automation: ${automation.name} (${automation._id})`);
      }
    }
    
    console.log(`Migration completed! Updated ${updatedCount} automations.`);
    console.log(`Total automations processed: ${automations.length}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the migration
addVerificationStatusToAutomationTemplates();
