import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateOTP, sendOTPEmail } from '../utils/emailUtils.js';
import Team from '../models/Team.js';

const router = express.Router();

// Request OTP for registration
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(400).json({ message: 'User already exists. Please login instead.' });
      }
      
     
      
      // If user exists but not verified, delete the old record
      await User.deleteOne({ email });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new temporary user with only email and OTP
    const tempUser = await User.create({
      email,
      otp: {
        code: otp,
        expiresAt: otpExpiry
      },
      isEmailVerified: false
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
      res.status(200).json({ 
        message: 'OTP sent successfully',
        otp: otp, // Include OTP in response for development
        expiresIn: 600 // 10 minutes in seconds
      });
    } catch (emailError) {
      // Delete the temporary user if email sending fails
      await User.deleteOne({ email });
      throw new Error('Failed to send OTP email. Please try again.');
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify OTP and complete registration
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, firstName, lastName, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !password) {
      return res.status(400).json({ message: 'All fields are required for registration' });
    }

    // Find user with the provided email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email' });
    }

    // Check if OTP exists and is valid
    if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({ message: 'No OTP requested' });
    }

    // Check if OTP has expired
    if (new Date() > user.otp.expiresAt) {
      // Delete expired OTP user
      await User.deleteOne({ email });
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Update user with registration details
    user.firstName = firstName;
    user.lastName = lastName;
    user.password = password;
    user.isEmailVerified = true;
    user.otp = undefined; // Clear OTP after successful verification

    // Assign admin role to specific email
    if (email === 'kalariyakuldeep8238@gmail.com') {
      user.role = 'Admin';
      user.status = 'approved'; // Auto-approve admin user
    }

    await user.save();

    // Instead of creating token, return success message
    res.status(201).json({
      message: 'Registration successful! Please login to continue.',
      success: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({ message: 'Please verify your email first' });
    }

    // Check if user is approved
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending approval. Please wait for Admin approval.' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account has been rejected by the administrator. Please contact Admin for more information.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      team: user.team,
      role: user.role,
      role2: user.role2,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      photo: user.photo,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Request OTP for password reset
router.post('/request-reset-otp', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.isEmailVerified) {
      return res.status(400).json({ message: 'No verified user found with this email.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP and new password temporarily
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      newPassword // Store new password temporarily
    };
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
      res.status(200).json({ message: 'OTP sent successfully' });
    } catch (emailError) {
      user.otp = undefined;
      await user.save();
      throw new Error('Failed to send OTP email. Please try again.');
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify OTP and reset password
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.otp || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({ message: 'No OTP requested' });
    }

    // Check if OTP has expired
    if (new Date() > user.otp.expiresAt) {
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.otp = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 