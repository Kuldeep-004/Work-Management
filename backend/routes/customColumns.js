import express from 'express';
import CustomColumn from '../models/CustomColumn.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Get all custom columns (public for all authenticated users)
router.get('/', protect, async (req, res) => {
  try {
    // Check if we need to include inactive columns (for admin column management)
    const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'Admin';
    
    const query = includeInactive ? {} : { isActive: true };
    
    const customColumns = await CustomColumn.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ isActive: -1, order: 1, createdAt: 1 });
    
    res.json(customColumns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new custom column (Admin only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, label, type, defaultValue, options, order } = req.body;

    // Validate required fields
    if (!name || !label || !type) {
      return res.status(400).json({ message: 'Name, label, and type are required' });
    }

    // Validate type
    if (!['text', 'checkbox', 'tags'].includes(type)) {
      return res.status(400).json({ message: 'Type must be one of: text, checkbox, tags' });
    }

    // Check if column name already exists
    const existingColumn = await CustomColumn.findOne({ name: name.trim() });
    if (existingColumn) {
      return res.status(400).json({ message: 'Column with this name already exists' });
    }

    // Validate options for tags type
    if (type === 'tags' && (!options || !Array.isArray(options) || options.length === 0)) {
      return res.status(400).json({ message: 'Tags type requires at least one option' });
    }

    const customColumn = new CustomColumn({
      name: name.trim(),
      label: label.trim(),
      type,
      defaultValue: type === 'checkbox' ? (defaultValue === true || defaultValue === 'true') : 
                   type === 'tags' ? (Array.isArray(defaultValue) ? defaultValue : []) :
                   defaultValue || '',
      options: type === 'tags' ? options : [],
      order: order || 1000,
      createdBy: req.user._id
    });

    const savedColumn = await customColumn.save();
    await savedColumn.populate('createdBy', 'firstName lastName');
    
    // Log column creation
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'custom_column_created',
      savedColumn._id,
      `Created custom column "${label.trim()}"`,
      null,
      { name: name.trim(), label: label.trim(), type, options },
      req
    );
    
    res.status(201).json(savedColumn);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update custom column (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { name, label, type, defaultValue, options, order, isActive } = req.body;

    const customColumn = await CustomColumn.findById(req.params.id);
    if (!customColumn) {
      return res.status(404).json({ message: 'Custom column not found' });
    }

    // Store old values for logging
    const oldValues = {
      name: customColumn.name,
      label: customColumn.label,
      type: customColumn.type,
      options: customColumn.options,
      isActive: customColumn.isActive
    };

    // Check if new name already exists (excluding current column)
    if (name && name.trim() !== customColumn.name) {
      const existingColumn = await CustomColumn.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingColumn) {
        return res.status(400).json({ message: 'Column with this name already exists' });
      }
    }

    // Update fields
    if (name) customColumn.name = name.trim();
    if (label) customColumn.label = label.trim();
    if (type && ['text', 'checkbox', 'tags'].includes(type)) customColumn.type = type;
    if (defaultValue !== undefined) customColumn.defaultValue = defaultValue;
    if (options && Array.isArray(options)) customColumn.options = options;
    if (order !== undefined) customColumn.order = order;
    if (isActive !== undefined) customColumn.isActive = isActive;

    const updatedColumn = await customColumn.save();
    await updatedColumn.populate('createdBy', 'firstName lastName');
    
    // Log column update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'custom_column_updated',
      updatedColumn._id,
      `Updated custom column "${customColumn.label}"`,
      oldValues,
      { name, label, type, options, isActive },
      req
    );
    
    res.json(updatedColumn);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete custom column (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const customColumn = await CustomColumn.findById(req.params.id);
    if (!customColumn) {
      return res.status(404).json({ message: 'Custom column not found' });
    }

    // Check if column is being used in any tasks
    const tasksWithColumn = await Task.countDocuments({ [`customFields.${customColumn.name}`]: { $exists: true } });
    if (tasksWithColumn > 0) {
      return res.status(400).json({ 
        message: `Cannot delete column. It contains data in ${tasksWithColumn} task(s). You can deactivate it instead.`,
        tasksCount: tasksWithColumn
      });
    }

    // Log column deletion before deleting
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'custom_column_deleted',
      customColumn._id,
      `Deleted custom column "${customColumn.label}"`,
      { name: customColumn.name, label: customColumn.label, type: customColumn.type },
      null,
      req
    );

    await CustomColumn.findByIdAndDelete(req.params.id);
    res.json({ message: 'Custom column deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle column active status (Admin only)
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const customColumn = await CustomColumn.findById(req.params.id);
    if (!customColumn) {
      return res.status(404).json({ message: 'Custom column not found' });
    }

    const oldStatus = customColumn.isActive;
    customColumn.isActive = !customColumn.isActive;
    
    const updatedColumn = await customColumn.save();
    await updatedColumn.populate('createdBy', 'firstName lastName');
    
    // Log status change
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'custom_column_toggled',
      updatedColumn._id,
      `${customColumn.isActive ? 'Activated' : 'Deactivated'} custom column "${customColumn.label}"`,
      { isActive: oldStatus },
      { isActive: customColumn.isActive },
      req
    );
    
    res.json(updatedColumn);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
