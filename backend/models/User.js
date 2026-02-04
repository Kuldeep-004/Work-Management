import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: function () {
        return this.isEmailVerified;
      },
    },
    lastName: {
      type: String,
      required: function () {
        return this.isEmailVerified;
      },
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
      required: function () {
        return this.isEmailVerified;
      },
    },
    photo: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    role: {
      type: String,
      enum: ["Fresher", "Senior", "Team Head", "Admin"],
      default: "Fresher",
    },
    role2: {
      type: [String],
      enum: ["None", "TimeSheet Verifier", "Task Verifier"],
      default: ["None"],
    },
    timesheetView: {
      type: String,
      enum: ["default", "team"],
      default: "default",
    },
    userAccessLevel: {
      type: String,
      enum: ["Team Only", "All Users"],
      default: "Team Only",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "deleted"],
      default: "pending",
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
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    pushSubscription: {
      endpoint: String,
      keys: {
        p256dh: String,
        auth: String,
      },
    },
    notificationPermission: {
      type: String,
      enum: ["default", "granted", "denied"],
      default: "default",
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
