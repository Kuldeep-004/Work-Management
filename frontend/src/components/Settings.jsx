import defaultProfile from '../assets/avatar.jpg';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  });
  const [tasks, setTasks] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('Account settings');
  
  // Priority management state
  const [priorities, setPriorities] = useState([]);
  const [loadingPriorities, setLoadingPriorities] = useState(false);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tasksRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tasks?type=received`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      } catch (error) {
        toast.error('Failed to fetch user stats');
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [user]);

  // Calculate stats
  const totalTasks = tasks.length;
  const pendingOrInProgressTasks = tasks.filter(t => t.status === 'yet_to_start' || t.status === 'in_progress').length;
  const urgentTasks = tasks.filter(t => (t.status === 'yet_to_start' || t.status === 'in_progress') && t.priority === 'urgent').length;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload photo');
      }

      const data = await response.json();
      updateUser(data);
      toast.success('Profile photo updated successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      updateUser(data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Priority management functions
  const fetchPriorities = async () => {
    if (user.role !== 'Admin' && user.role !== 'Team Head') return;
    
    setLoadingPriorities(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch priorities');
      const data = await response.json();
      setPriorities(data);
    } catch (error) {
      toast.error('Failed to fetch priorities');
    } finally {
      setLoadingPriorities(false);
    }
  };

  const addPriority = async () => {
    if (!newPriorityName.trim()) {
      toast.error('Priority name is required');
      return;
    }

    setAddingPriority(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newPriorityName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add priority');
      }

      toast.success('Priority added successfully');
      setNewPriorityName('');
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingPriority(false);
    }
  };

  const deletePriority = async (priorityId) => {
    if (!confirm('Are you sure you want to delete this priority?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities/${priorityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete priority');
      }

      toast.success('Priority deleted successfully');
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Fetch priorities when tab changes to Priority Management
  useEffect(() => {
    if (activeTab === 'Priority Management') {
      fetchPriorities();
    }
  }, [activeTab]);

  const tabs = [
    'Account settings',
    ...(user.role === 'Admin' || user.role === 'Team Head' ? ['Priority Management'] : [])
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Profile Card */}
      <div className="bg-[#485bbd] px-4 sm:px-8 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-6 relative">
        <div className="flex flex-col md:flex-row items-center w-full md:w-auto gap-4">
          <div className="relative">
            <img
              src={user.photo?.url || defaultProfile}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white object-cover shadow-lg bg-white"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={handlePhotoClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-gray-200 rounded-full p-1 cursor-pointer border border-gray-300 hover:bg-gray-300 transition-colors"
            >
              {uploading ? (
                <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zm0 0v3h3" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-xl md:text-2xl text-white">{user.firstName} {user.lastName}</span>
            <span className="text-white text-sm md:text-[14px] mt-1">{user.email}</span>
            <span className="text-xs md:text-[12px] mt-1 bg-[#4f46e5] text-white px-2 py-0.5 rounded inline-block">
              {user.role}
            </span>
          </div>
        </div>
        {/* Stats 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto md:flex md:flex-col md:justify-around md:items-start md:pb-2 md:mt-0">
          <div className="flex flex-col items-center md:flex-row md:gap-16">
            {/* Stat: Total Tasks Ever Received */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : totalTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Total Tasks</span>
            </div>
            {/* Stat: Pending/In-Progress Tasks */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : pendingOrInProgressTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Pending Tasks</span>
            </div>
          </div>
          <div className="flex flex-col items-center md:flex-row md:gap-16 mt-0 md:mt-2">
            {/* Stat: Urgent Pending/In-Progress Tasks */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : urgentTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Urgent Tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="-mb-px flex space-x-8 overflow-x-auto px-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none transition-all ${
                tab === activeTab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-blue-700 hover:border-blue-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="max-w-4xl bg-white rounded-lg p-4 md:p-0 mx-auto">
        {activeTab === 'Account settings' && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Account settings</h2>
            <form onSubmit={handleSubmit}>
              <div className="divide-y divide-gray-200">
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">First Name</div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="First Name"
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">Last Name</div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Last Name"
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">Email</div>
                  <div className="w-full md:w-2/3">
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                </div>
              </div>
              <div className="px-0 md:px-6 py-4 bg-white text-right">
                <button
                  type="submit"
                  className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save
                </button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'Priority Management' && (user.role === 'Admin' || user.role === 'Team Head') && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Priority Management</h2>
            
            {/* Add New Priority */}
            <div className="px-0 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-md font-medium text-gray-800 mb-3">Add New Priority</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newPriorityName}
                  onChange={(e) => setNewPriorityName(e.target.value)}
                  placeholder="Enter priority name"
                  className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={addPriority}
                  disabled={addingPriority || !newPriorityName.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {addingPriority ? 'Adding...' : 'Add Priority'}
                </button>
              </div>
            </div>

            {/* Priorities List */}
            <div className="px-0 md:px-6 py-4">
              <h3 className="text-md font-medium text-gray-800 mb-3">Current Priorities</h3>
              
              {loadingPriorities ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading priorities...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priorities.map((priority) => (
                    <div
                      key={priority._id || priority.name}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-gray-800">{priority.name}</span>
                        {priority.isDefault && (
                          <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      
                      {!priority.isDefault && (
                        <button
                          onClick={() => deletePriority(priority._id)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1"
                          title="Delete priority"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {priorities.length === 0 && (
                    <p className="text-gray-600 text-center py-4">No priorities found.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings; 