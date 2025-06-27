import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import defaultProfile from '../assets/avatar.jpg';
import { UserCircleIcon, KeyIcon, ArrowRightOnRectangleIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const TopBar = (props) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { logout, user: contextUser } = useAuth();
  const user = props.user || contextUser;
  const { onSidebarToggle } = props;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleProfileClick = () => {
    navigate('/dashboard/settings');
    setIsDropdownOpen(false);
  };

  const handleChangePassword = () => {
    navigate('/forgot-password');
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDropdownOpen(false);
  };

  return (
    <header className="w-full h-16 bg-white shadow flex items-center px-4 sm:px-6 justify-between">
      {/* Hamburger for mobile */}
      <div className="flex items-center">
        <button
          className="md:hidden mr-3 p-2 rounded hover:bg-gray-100 focus:outline-none"
          onClick={onSidebarToggle}
          aria-label="Open sidebar"
        >
          <Bars3Icon className="h-6 w-6 text-gray-700" />
        </button>
        {/* Website Name and Subtitle */}
        <div className="flex flex-col justify-center">
          <span className="text-xl md:text-xl mb-1 text-gray-800 leading-tight">Hari Agarwal & Associates</span>
          <span className="text-xs md:text-sm text-gray-500 -mt-1">Chartered Accountants</span>
        </div>
      </div>
      
      {/* Notification Bell and User Profile */}
      <div className="flex items-center space-x-4">
        <NotificationBell />
        
        {/* User Profile with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center hover:bg-gray-50 p-1.5 rounded-lg transition-colors"
          >
            <img src={user?.photo?.url || defaultProfile} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
            <span className="ml-2 text-sm md:text-base font-normal text-gray-800 hidden sm:inline">{user?.firstName} {user?.lastName}</span>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
              <button
                onClick={handleProfileClick}
                className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <UserCircleIcon className="w-5 h-5 mr-3" />
                <span className='text-sm'>My Profile</span>
              </button>
              <button
                onClick={handleChangePassword}
                className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <KeyIcon className="w-5 h-5 mr-3" />
                <span className='text-sm'>Reset Password</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                <span className='text-sm'>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;