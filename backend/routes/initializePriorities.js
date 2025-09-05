// Script to initialize priority orders for existing priorities
// This ensures all priorities have an order field

import express from 'express';
import Priority from '../models/Priority.js';
import mongoose from 'mongoose';

const router = express.Router();

// Initialize priority orders (run this once to fix existing data)
router.get('/initialize-priority-orders', async (req, res) => {
  try {
    console.log('Initializing priority orders...');
    
    // Get all priorities that don't have an order or have order = null
    const prioritiesWithoutOrder = await Priority.find({
      $or: [
        { order: { $exists: false } },
        { order: null },
        { order: undefined }
      ]
    }).sort({ createdAt: 1 });

    console.log(`Found ${prioritiesWithoutOrder.length} priorities without order`);

    if (prioritiesWithoutOrder.length === 0) {
      return res.json({ message: 'All priorities already have order values' });
    }

    // Get the highest existing order value
    const highestOrderPriority = await Priority.findOne({ order: { $exists: true, $ne: null } }).sort({ order: -1 });
    let nextOrder = highestOrderPriority ? highestOrderPriority.order + 1 : 1;

    // Update each priority without order
    for (const priority of prioritiesWithoutOrder) {
      await Priority.findByIdAndUpdate(priority._id, { order: nextOrder });
      console.log(`Set priority "${priority.name}" order to ${nextOrder}`);
      nextOrder++;
    }

    res.json({ 
      message: `Successfully initialized orders for ${prioritiesWithoutOrder.length} priorities`,
      count: prioritiesWithoutOrder.length
    });
  } catch (error) {
    console.error('Error initializing priority orders:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
