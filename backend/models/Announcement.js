import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index to automatically remove expired announcements
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement; 