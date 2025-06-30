import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Array of email configurations
const emailConfigs = [
  {
    user: process.env.EMAIL_USER_1,
    pass: process.env.EMAIL_PASSWORD_1
  },
  {
    user: process.env.EMAIL_USER_2,
    pass: process.env.EMAIL_PASSWORD_2
  }
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
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
};

// Generate a 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
export const sendOTPEmail = async (email, otp) => {
  // Check if any email configuration exists
  if (!emailConfigs.some(config => config.user && config.pass)) {
    throw new Error('Email configuration is missing. Please check your environment variables.');
  }

  const mailOptions = {
    from: {
      name: 'HAACAS',
      address: getNextEmailConfig().user
    },
    to: email,
    subject: 'Your OTP for Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Your OTP for registration is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    
    // Verify transporter configuration
    await transporter.verify();
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email sending error details:', {
      code: error.code,
      command: error.command,
      response: error.response
    });

    // If we hit the sending limit, try the next email account
    if (error.code === 'EENVELOPE' && error.response?.includes('Daily user sending limit exceeded')) {
      try {
        const newTransporter = createTransporter();
        const info = await newTransporter.sendMail(mailOptions);
        return info;
      } catch (retryError) {
        throw new Error('All email accounts have reached their sending limits. Please try again later.');
      }
    }

    throw new Error('Failed to send OTP email. Please try again later.');
  }
}; 