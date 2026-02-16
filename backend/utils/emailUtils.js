import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Array of email configurations
const emailConfigs = [
  {
    user: process.env.EMAIL_USER_1,
    pass: process.env.EMAIL_PASSWORD_1,
  },
  {
    user: process.env.EMAIL_USER_2,
    pass: process.env.EMAIL_PASSWORD_2,
  },
  // Add more email configurations as needed
];

let currentEmailIndex = 0;

// Get next email configuration
const getNextEmailConfig = () => {
  const config = emailConfigs[currentEmailIndex];
  currentEmailIndex = (currentEmailIndex + 1) % emailConfigs.length;
  return config;
};

// Create transporter with current email config
const createTransporter = () => {
  const config = getNextEmailConfig();
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
};

// Generate a 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
export const sendOTPEmail = async (email, otp) => {
  // Check if any email configuration exists
  if (!emailConfigs.some((config) => config.user && config.pass)) {
    throw new Error(
      "Email configuration is missing. Please check your environment variables.",
    );
  }

  const mailOptions = {
    from: {
      name: "HAACAS",
      address: getNextEmailConfig().user,
    },
    to: email,
    subject: "Your OTP for Registration",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Your OTP for registration is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const transporter = createTransporter();

    // Verify transporter configuration
    await transporter.verify();

    // Send email
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Email sending error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
    });

    // If we hit the sending limit, try the next email account
    if (
      error.code === "EENVELOPE" &&
      error.response?.includes("Daily user sending limit exceeded")
    ) {
      try {
        const newTransporter = createTransporter();
        const info = await newTransporter.sendMail(mailOptions);
        return info;
      } catch (retryError) {
        throw new Error(
          "All email accounts have reached their sending limits. Please try again later.",
        );
      }
    }

    throw new Error("Failed to send OTP email. Please try again later.");
  }
};

/**
 * Send daily backup and timesheets email to all admin users
 * @param {Array} adminEmails - Array of admin email addresses
 * @param {string} backupFilePath - Path to backup file
 * @param {string} timesheetFilePath - Path to timesheet CSV file
 * @param {Date} date - Date for the report
 * @returns {Promise} - Email send result
 */
export const sendDailyBackupEmail = async (
  adminEmails,
  backupFilePath,
  timesheetFilePath,
  date,
  previousWorkingDay,
) => {
  // Check if any email configuration exists
  if (!emailConfigs.some((config) => config.user && config.pass)) {
    throw new Error(
      "Email configuration is missing. Please check your environment variables.",
    );
  }

  const dateStr = date.toISOString().split("T")[0];
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });

  const mailOptions = {
    from: {
      name: "HAACAS Work Management System",
      address: emailConfigs[0].user,
    },
    to: adminEmails.join(", "),
    subject: `Daily Backup & Timesheets Report - ${dateStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            📊 Daily Report
          </h2>
          
          <div style="margin: 20px 0;">
            <p style="color: #555; font-size: 16px;">
              <strong>Report Date:</strong> ${dateStr} (${dayOfWeek})
            </p>
          </div>

          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2980b9; margin-top: 0;">📦 Database Backup</h3>
            <p style="color: #555;">
              The latest database backup has been generated and is attached to this email. 
              This backup is also stored securely in pCloud.
            </p>
          </div>

          <div style="background-color: #fef9e7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #d68910; margin-top: 0;">⏱️ Timesheets Report</h3>
            <p style="color: #555;">
              Attached is the timesheets report for the previous working day. 
              The report includes all submitted timesheets with user details and time entries.
            </p>
          </div>

        </div>
      </div>
    `,
    attachments: [],
  };

  // Add backup file as attachment
  if (backupFilePath) {
    mailOptions.attachments.push({
      filename: `Backup-${dateStr}.gz`,
      path: backupFilePath,
    });
  }

  // Add timesheet file as attachment
  if (timesheetFilePath) {
    mailOptions.attachments.push({
      filename: `Timesheets-${previousWorkingDay}.pdf`,
      path: timesheetFilePath,
    });
  }

  try {
    const transporter = createTransporter();

    // Verify transporter configuration
    await transporter.verify();

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(
      "[DailyEmailScheduler] Successfully sent daily backup email to admins",
    );
    return info;
  } catch (error) {
    console.error("[DailyEmailScheduler] Email sending error:", {
      code: error.code,
      command: error.command,
      response: error.response,
    });

    // If we hit the sending limit, try the next email account
    if (
      error.code === "EENVELOPE" &&
      error.response?.includes("Daily user sending limit exceeded")
    ) {
      try {
        const newTransporter = createTransporter();
        const info = await newTransporter.sendMail(mailOptions);
        console.log(
          "[DailyEmailScheduler] Successfully sent daily backup email using alternate account",
        );
        return info;
      } catch (retryError) {
        throw new Error(
          "All email accounts have reached their sending limits. Please try again later.",
        );
      }
    }

    throw new Error(`Failed to send daily backup email: ${error.message}`);
  }
};
