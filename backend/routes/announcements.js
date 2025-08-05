import express from 'express';
import Announcement from '../models/Announcement.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Create announcement (admin only)
router.post('/', [protect, admin], async (req, res) => {
    try {
        const announcement = new Announcement({
            content: req.body.content,
            createdBy: req.user._id,
            expiresAt: req.body.expiresAt
        });
        await announcement.save();
        
        // Log announcement creation
        await ActivityLogger.logSystemActivity(
            req.user._id,
            'announcement_created',
            announcement._id,
            `Created announcement: "${req.body.content.substring(0, 50)}${req.body.content.length > 50 ? '...' : ''}"`,
            null,
            { 
                content: req.body.content, 
                expiresAt: req.body.expiresAt 
            },
            req
        );
        
        res.status(201).json(announcement);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all active announcements
router.get('/', protect, async (req, res) => {
    try {
        const announcements = await Announcement.find({
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete announcement (admin only)
router.delete('/:id', [protect, admin], async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        
        // Log announcement deletion before deleting
        await ActivityLogger.logSystemActivity(
            req.user._id,
            'announcement_deleted',
            announcement._id,
            `Deleted announcement: "${announcement.content.substring(0, 50)}${announcement.content.length > 50 ? '...' : ''}"`,
            { 
                content: announcement.content, 
                expiresAt: announcement.expiresAt 
            },
            null,
            req
        );
        
        await announcement.deleteOne();
        res.json({ message: 'Announcement deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router; 