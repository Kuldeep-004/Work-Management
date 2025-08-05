import mongoose from 'mongoose';
import Automation from '../models/Automation.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const migrateAutomationMonths = async () => {
  try {
    console.log('Starting automation months migration...');
    
    // Find all quarterly automations with old monthOfYear field
    const quarterlyAutomations = await Automation.find({
      triggerType: 'quarterly',
      monthOfYear: { $exists: true },
      quarterlyMonths: { $exists: false }
    });
    
    console.log(`Found ${quarterlyAutomations.length} quarterly automations to migrate`);
    
    for (const automation of quarterlyAutomations) {
      // Map old monthOfYear to appropriate quarterly months
      let quarterlyMonths = [1, 4, 7, 10]; // Default to all quarters
      
      if (automation.monthOfYear === 1) {
        quarterlyMonths = [1, 4, 7, 10]; // Starting from January
      } else if (automation.monthOfYear === 4) {
        quarterlyMonths = [4, 7, 10, 1]; // Starting from April
      } else if (automation.monthOfYear === 7) {
        quarterlyMonths = [7, 10, 1, 4]; // Starting from July
      } else if (automation.monthOfYear === 10) {
        quarterlyMonths = [10, 1, 4, 7]; // Starting from October
      }
      
      await Automation.findByIdAndUpdate(automation._id, {
        $set: { quarterlyMonths },
        $unset: { monthOfYear: 1 }
      });
      
      console.log(`Migrated quarterly automation ${automation._id}: ${automation.name}`);
    }
    
    // Find all half-yearly automations with old monthOfYear field
    const halfYearlyAutomations = await Automation.find({
      triggerType: 'halfYearly',
      monthOfYear: { $exists: true },
      halfYearlyMonths: { $exists: false }
    });
    
    console.log(`Found ${halfYearlyAutomations.length} half-yearly automations to migrate`);
    
    for (const automation of halfYearlyAutomations) {
      // Map old monthOfYear to appropriate half-yearly months
      let halfYearlyMonths = [1, 7]; // Default to January and July
      
      if (automation.monthOfYear === 1) {
        halfYearlyMonths = [1, 7]; // Starting from January
      } else if (automation.monthOfYear === 7) {
        halfYearlyMonths = [7, 1]; // Starting from July
      }
      
      await Automation.findByIdAndUpdate(automation._id, {
        $set: { halfYearlyMonths },
        $unset: { monthOfYear: 1 }
      });
      
      console.log(`Migrated half-yearly automation ${automation._id}: ${automation.name}`);
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateAutomationMonths();
