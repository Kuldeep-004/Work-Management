import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: function() {
        return this.isEmailVerified;
      }
    },
    lastName: {
      type: String,
      required: function() {
        return this.isEmailVerified;
      }
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function() {
        return this.isEmailVerified; // Only required after email verification
      }
    },
    photo: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      }
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    role: {
      type: String, 
      enum: ['Fresher', 'Team Head','Head', 'Admin'],
      default: 'Fresher',
    },
    role2: {
      type: String,
      enum: ['None', 'TimeSheet Verifier', 'Task Verifier'],
      default: 'None',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User; 