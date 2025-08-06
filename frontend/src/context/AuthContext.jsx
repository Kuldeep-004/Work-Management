import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';
import pushNotificationManager from '../utils/pushNotificationManager';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Verify token exists
          if (!parsedUser.token) {
            throw new Error('Invalid user data');
          }
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please try again.');
      }

      if (!data.token) {
        throw new Error('Invalid response from server');
      }

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      
      // Initialize push notifications after successful login
      await initializePushNotifications(data.token);
      
      toast.success('Login successful!');
      return data;
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'An error occurred during login');
      throw error;
    }
  };

  const initializePushNotifications = async (token) => {
    try {
      const initialized = await pushNotificationManager.initialize();
      if (!initialized) {
        console.log('Push notifications not supported or failed to initialize');
        return;
      }

      const permission = await pushNotificationManager.requestPermission();
      
      if (permission === 'granted') {
        await pushNotificationManager.subscribe(token);
        toast.success('You will receive timesheet reminders!');
      } else if (permission === 'denied') {
        await pushNotificationManager.updatePermissionStatus('denied', token);
        toast('Push notifications are disabled. You can enable them in your browser settings.', {
          icon: '🔔',
          duration: 5000
        });
      }
      
      await pushNotificationManager.updatePermissionStatus(permission, token);
    } catch (error) {
      console.error('Error setting up push notifications:', error);
      // Don't show error to user as it's not critical to login
    }
  };

  const requestOTP = async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.expiresIn) {
          const minutes = Math.ceil(data.expiresIn / 60);
          throw new Error(`${data.message} (${minutes} minutes remaining)`);
        }
        throw new Error(data.message);
      }

      
      toast.success('OTP sent to your email!');
      return data;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const verifyOTPAndRegister = async (email, otp, firstName, lastName, password, group) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          firstName,
          lastName,
          password,
          group,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      // Don't set user or store in localStorage since we're redirecting to login
      toast.success(data.message || 'Registration successful! Please login to continue.');
      return data;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Unsubscribe from push notifications before logging out
      if (user?.token) {
        await pushNotificationManager.unsubscribe(user.token);
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
    }
    
    setUser(null);
    localStorage.removeItem('user');
    toast.success('Logged out successfully!');
  };

  // Add a function to check if token is valid
  const isAuthenticated = () => {
    return !!user?.token;
  };

  // Add a function to update user data
  const updateUser = (newUserData) => {
    const updatedUser = { ...user, ...newUserData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const resetPassword = {
    requestOTP: async (email, newPassword) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/request-reset-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to request OTP');
        }

        toast.success('OTP sent to your email!');
        return data;
      } catch (error) {
        toast.error(error.message);
        throw error;
      }
    },

    verifyOTP: async (email, newPassword, otp) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-reset-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email, 
            newPassword,
            otp 
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to verify OTP');
        }

        toast.success('Password reset successful!');
        return data;
      } catch (error) {
        toast.error(error.message);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        requestOTP,
        verifyOTPAndRegister,
        isAuthenticated,
        resetPassword,
        token: user?.token,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 