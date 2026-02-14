import mongoose from "mongoose";
import TaskStatus from "./TaskStatus.js";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientGroup: {
      type: String,
      required: true,
      trim: true,
    },
    workType: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    billed: {
      type: Boolean,
      default: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "yet_to_start",
      validate: {
        validator: async function (value) {
          // Check if status exists in TaskStatus collection and is active
          const validStatus = await TaskStatus.findOne({
            name: value,
            isActive: true,
          });
          return validStatus !== null;
        },
        message:
          "Invalid task status. Status must be an active status in the system.",
      },
    },
    priority: {
      type: String,
      required: true,
      default: "regular",
    },
    inwardEntryDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    targetDate: {
      type: Date,
    },
    verificationAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    secondVerificationAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    thirdVerificationAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fourthVerificationAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fifthVerificationAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    originalAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    files: [
      {
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
        cloudUrl: {
          type: String,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        type: {
          type: String,
          enum: ["text", "audio", "file"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        audioUrl: {
          type: String,
        },
        files: [
          {
            filename: String,
            originalName: String,
            path: String,
            cloudUrl: String,
            size: Number,
            mimetype: String,
          },
        ],
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isEdited: {
          type: Boolean,
          default: false,
        },
        editedAt: {
          type: Date,
        },
        mentions: [
          {
            type: String,
          },
        ],
      },
    ],
    selfVerification: {
      type: Boolean,
      default: false,
    },
    verification: {
      type: String,
      enum: ["pending", "rejected", "accepted", "next verification"],
      default: "pending",
    },
    verificationRemarks: {
      type: String,
      trim: true,
    },
    guides: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    itrProgress: {
      draftFinancialsAndComputationPreparation: {
        type: Boolean,
        default: false,
      },
      accountantVerification: {
        type: Boolean,
        default: false,
      },
      vivekSirVerification: {
        type: Boolean,
        default: false,
      },
      girijaVerification: {
        type: Boolean,
        default: false,
      },
      hariSirVerification: {
        type: Boolean,
        default: false,
      },
      issuedForPartnerProprietorVerification: {
        type: Boolean,
        default: false,
      },
      challanPreparation: {
        type: Boolean,
        default: false,
      },
      itrFiledOn: {
        type: Date,
      },
      billPreparation: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Task", taskSchema);
