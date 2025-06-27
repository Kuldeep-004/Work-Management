import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';

const CreateTask = ({ users = [] }) => {
  const { user: loggedInUser, isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkTypeModalOpen, setIsWorkTypeModalOpen] = useState(false);
  const [workTypeFormData, setWorkTypeFormData] = useState({ name: '' });
  const [clients, setClients] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientName: '',
    clientGroup: '',
    workType: [],
    assignedTo: [],
    priority: 'regular',
    inwardEntryDate: '',
    dueDate: '',
    targetDate: ''
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const modalRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [taskFiles, setTaskFiles] = useState([]);
  const [createdTaskId, setCreatedTaskId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const [isWorkTypeDropdownOpen, setIsWorkTypeDropdownOpen] = useState(false);
  const [workTypeSearchTerm, setWorkTypeSearchTerm] = useState("");

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_FILES = 10;

  // Fetch clients, client groups, and work types
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch clients
        const clientsResponse = await fetch('http://localhost:5000/api/clients', {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });
        const clientsData = await clientsResponse.json();
        setClients(clientsData);

        // Fetch client groups
        const groupsResponse = await fetch('http://localhost:5000/api/clients/groups', {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });
        const groupsData = await groupsResponse.json();
        setClientGroups(groupsData);

        // Fetch work types
        const workTypesResponse = await fetch('http://localhost:5000/api/clients/work-types', {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });
        const workTypesData = await workTypesResponse.json();
        setWorkTypes(workTypesData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch required data');
      }
    };

    if (isModalOpen) {
      fetchData();
    }
  }, [isModalOpen, loggedInUser]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    return clients.filter(client => 
      client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      (client.group && client.group.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
    );
  }, [clients, clientSearchTerm]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) && !event.target.closest('.work-type-modal')) {
        setIsModalOpen(false);
        setIsDropdownOpen(false);
        setIsClientDropdownOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  const validateFiles = (files) => {
    const newFiles = Array.from(files);
    const errors = [];

    // Check total number of files
    if (selectedFiles.length + newFiles.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed`);
    }

    // Check individual file sizes and total size
    let totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    newFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 10MB limit`);
      }
      totalSize += file.size;
    });

    if (totalSize > MAX_TOTAL_SIZE) {
      errors.push(`Total size exceeds 50MB limit`);
    }

    // Check file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];

    newFiles.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name} is not a supported file type`);
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      return false;
    }

    return true;
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to Array and validate
    const newFiles = Array.from(files);
    console.log('Selected files:', newFiles); // Debug log

    if (validateFiles(newFiles)) {
      setSelectedFiles(prev => {
        const updatedFiles = [...prev, ...newFiles];
        console.log('Updated selected files:', updatedFiles); // Debug log
        return updatedFiles;
      });
    }
    // Reset the input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error('Please login to create tasks');
      return;
    }

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Task Title is required');
      return;
    }

    if (!formData.clientName.trim()) {
      toast.error('Client Name is required');
      return;
    }

    if (!formData.inwardEntryDate) {
      toast.error('Inward Entry Date is required');
      return;
    }

    if (formData.assignedTo.length === 0) {
      toast.error('Please select at least one user to assign the task to');
      return;
    }

    if (formData.workType.length === 0) {
      toast.error('Please select at least one work type');
      return;
    }

    try {
      setUploading(true);
      console.log('Creating task with files:', selectedFiles); // Debug log

      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create task');
      }

      const createdTasks = await response.json();
      console.log('Tasks created:', createdTasks); // Debug log
      
      if (createdTasks && Array.isArray(createdTasks) && createdTasks.length > 0) {
        toast.success(`${createdTasks.length} task(s) created successfully`);
        
        for (const task of createdTasks) {
          if (task && task._id) {
            if (selectedFiles.length > 0) {
              console.log('Starting file upload for task:', task._id); // Debug log
              try {
                await uploadFiles(task._id);
                toast.success(`Files uploaded for task: ${task.title}`);
              } catch (uploadError) {
                console.error('File upload error:', uploadError); // Debug log
                toast.error(`Task created but file upload failed for ${task.title}: ${uploadError.message}`);
              }
            }
          } else {
            console.error('Invalid task ID received for one of the tasks');
            toast.error('An error occurred while processing one of the created tasks.');
          }
        }
        
        // Close the modal after successful task creation and file uploads
        handleClose();
      } else {
        console.error('Invalid task ID received:', createdTasks);
        toast.error('An error occurred while creating the task. Invalid ID received.');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.message);
      setCreatedTaskId(null);
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async (taskId) => {
    if (!taskId) {
      throw new Error('Invalid task ID');
    }

    if (!selectedFiles.length) {
      console.log('No files to upload'); // Debug log
      return;
    }

    console.log('Uploading files for task:', taskId, 'Files:', selectedFiles); // Debug log
    setUploadProgress({});
    
    // Upload files in batches of 3
    const batchSize = 3;
    for (let i = 0; i < selectedFiles.length; i += batchSize) {
      const batch = selectedFiles.slice(i, i + batchSize);
      const formData = new FormData();
      
      batch.forEach(file => {
        formData.append('files', file);
      });

      try {
        console.log('Uploading batch:', batch); // Debug log
        const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/files`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to upload files');
        }

        const uploadedFiles = await response.json();
        console.log('Uploaded files response:', uploadedFiles); // Debug log
        
        setTaskFiles(prev => {
          const updatedFiles = [...prev, ...uploadedFiles];
          console.log('Updated task files:', updatedFiles); // Debug log
          return updatedFiles;
        });
        
        // Update progress for this batch
        batch.forEach((_, index) => {
          setUploadProgress(prev => ({
            ...prev,
            [i + index]: 'completed'
          }));
        });
      } catch (error) {
        console.error(`Failed to upload batch starting at index ${i}:`, error); // Debug log
        throw error;
      }
    }

    // Clear selected files only after all uploads are successful
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAssignedToChange = (userId) => {
    const user = users.find(u => u._id === userId);
    if (!user) return;

    setFormData(prev => {
      const newAssignedTo = prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId];
      
      setSelectedUsers(users.filter(u => newAssignedTo.includes(u._id)));
      return { ...prev, assignedTo: newAssignedTo };
    });
  };

  const handleWorkTypeChange = (type) => {
    setFormData(prev => {
      const newWorkType = prev.workType.includes(type)
        ? prev.workType.filter(t => t !== type)
        : [...prev.workType, type];
      
      return { ...prev, workType: newWorkType };
    });
  };

  const handleClientNameChange = (clientId) => {
    const selectedClient = clients.find(client => client._id === clientId);
    
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        clientName: selectedClient.name,
        clientGroup: selectedClient.group.name,
        workType: selectedClient.workOffered.map(wt => wt.name)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        clientName: '',
        clientGroup: '',
        workType: []
      }));
    }
    setIsClientDropdownOpen(false);
  };

  const selectedUserDisplay = selectedUsers.length > 0
    ? `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`
    : 'Select users';

  // Filter users based on role-based permissions
  const filteredUsers = users.filter(user => {
    // First filter by search term
    const matchesSearch = `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Then filter by role-based permissions
    if (loggedInUser.role === 'Admin') {
      // Admin can assign to anyone (including themselves)
      return true;
    } else if (loggedInUser.role === 'Head') {
      // Head can assign to any Team Head and Fresher (including themselves)
      return user.role === 'Team Head' || user.role === 'Fresher' || user._id === loggedInUser._id;
    } else if (loggedInUser.role === 'Team Head') {
      // Team Head can assign to any Fresher from their team (including themselves)
      return (user.role === 'Fresher' && user.team === loggedInUser.team) || user._id === loggedInUser._id;
    }
    
    // Freshers cannot assign tasks to anyone
    return false;
  });

  const handleWorkTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/clients/work-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify(workTypeFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to create work type');
      }

      const newWorkType = await response.json();
      setWorkTypes(prev => [...prev, newWorkType]);
      setIsWorkTypeModalOpen(false);
      setWorkTypeFormData({ name: '' });
      toast.success('Work type created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleFileDeleted = (fileId) => {
    setTaskFiles(prev => prev.filter(f => f._id !== fileId));
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormData({
      title: '',
      description: '',
      clientName: '',
      clientGroup: '',
      workType: [],
      assignedTo: [],
      priority: 'regular',
      inwardEntryDate: '',
      dueDate: '',
      targetDate: ''
    });
    setSelectedFiles([]);
    setTaskFiles([]);
    setCreatedTaskId(null);
    setUploading(false);
  };

  const filteredWorkTypes = useMemo(() => {
    if (!workTypeSearchTerm) return workTypes;
    return workTypes.filter(type => type.name.toLowerCase().includes(workTypeSearchTerm.toLowerCase()));
  }, [workTypes, workTypeSearchTerm]);

  useEffect(() => {
    const handleClickOutsideDropdown = (event) => {
      if (!event.target.closest('.work-type-dropdown')) {
        setTimeout(() => setIsWorkTypeDropdownOpen(false), 100);
      }
    };
    if (isWorkTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideDropdown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideDropdown);
    };
  }, [isWorkTypeDropdownOpen]);

  // Don't render anything for Freshers
  if (!isAuthenticated() || loggedInUser?.role === 'Fresher') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create Task
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Task</h2>
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => {
                        setClientSearchTerm(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      placeholder="Search client or group..."
                      className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {isClientDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <div
                              key={client._id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  clientName: client.name,
                                  clientGroup: client.group ? client.group.name : ''
                                }));
                                setClientSearchTerm(client.name);
                                setIsClientDropdownOpen(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{client.name}</div>
                              <div className="text-sm text-gray-500">{client.group ? client.group.name : 'No Group'}</div>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500">No clients found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Group <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clientGroup}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="today">Today</option>
                    <option value="lessThan3Days">&lt; 3 days</option>
                    <option value="thisWeek">This week</option>
                    <option value="thisMonth">This month</option>
                    <option value="regular">Regular</option>
                    <option value="filed">Filed</option>
                    <option value="dailyWorksOffice">Daily works office</option>
                    <option value="monthlyWorks">Monthly works</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inward Entry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.inwardEntryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, inwardEntryDate: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) =>
                      setFormData({ ...formData, targetDate: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full bottom-full mb-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        <div className="sticky top-0 bg-white p-2 border-b">
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="py-1">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                              <button
                                key={user._id}
                                type="button"
                                onClick={() => handleAssignedToChange(user._id)}
                                className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                                  formData.assignedTo.includes(user._id) ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3 overflow-hidden">
                                    <img 
                                      src={user.photo?.url || defaultProfile} 
                                      alt={`${user.firstName} ${user.lastName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {user.firstName} {user.lastName}
                                    </div>
                                    <div className="text-sm text-gray-500">{user.group}</div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-gray-500 text-center">No users found</div>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between border rounded-md px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="text-gray-700">
                        {selectedUserDisplay}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUsers.map(user => (
                        <span
                          key={user._id}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {user.firstName} {user.lastName}
                          <button
                            type="button"
                            onClick={() => handleAssignedToChange(user._id)}
                            className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 ">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Type <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center gap-2">
                  <div
                    className="w-full border rounded-md px-3 py-2 bg-white flex flex-wrap gap-2 min-h-[42px] cursor-pointer work-type-dropdown"
                    onClick={() => setIsWorkTypeDropdownOpen(true)}
                  >
                    {formData.workType.length === 0 && (
                      <span className="text-gray-400">Select or search work type...</span>
                    )}
                    {formData.workType.map(type => (
                      <span
                        key={type}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-400"
                      >
                        {type}
                        {formData.workType.includes(type) && <span className="float-right text-blue-600">✔</span>}
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); handleWorkTypeChange(type); }}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkTypeFormData({ name: '' });
                      setIsWorkTypeModalOpen(true);
                      setIsWorkTypeDropdownOpen(false);
                    }}
                    className="ml-2 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 border-2 border-gray-200 hover:bg-gray-200 whitespace-nowrap"
                  >
                    + New Work Type
                  </button>
                  {isWorkTypeDropdownOpen && (
                    <div className="absolute z-20 w-full max-w-[400px]  mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto work-type-dropdown">
                      <div className="sticky top-0 bg-white p-2 border-b">
                        <input
                          type="text"
                          placeholder="Search work type..."
                          value={workTypeSearchTerm}
                          onChange={e => setWorkTypeSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div className="py-1">
                        {filteredWorkTypes.length > 0 ? (
                          filteredWorkTypes.map(type => (
                            <button
                              key={type._id}
                              type="button"
                              className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 cursor-pointer ${formData.workType.includes(type.name) ? 'bg-blue-50' : ''}`}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleWorkTypeChange(type.name);
                              }}
                            >
                              {type.name}
                              {formData.workType.includes(type.name) && <span className="float-right text-blue-600">✔</span>}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500">No work types found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced File selection section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Attach Files (Optional)</h3>
                  <div className="text-sm text-gray-500">
                    Max {MAX_FILES} files, {MAX_FILE_SIZE / 1024 / 1024}MB per file, {MAX_TOTAL_SIZE / 1024 / 1024}MB total
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex-1">
                      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors">
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          ref={fileInputRef}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
                        />
                        <div className="text-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="mt-1 text-sm text-gray-600">
                            Click to select files or drag and drop
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            PDF, Word, Excel, PowerPoint, Images, Text files
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 border rounded-lg divide-y">
                      <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700">
                        Selected Files ({selectedFiles.length})
                      </div>
                      <ul className="divide-y">
                        {selectedFiles.map((file, index) => (
                          <li key={index} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-500">
                                {file.type.startsWith('image/') ? '🖼️' : 
                                 file.type.includes('pdf') ? '📄' :
                                 file.type.includes('word') ? '📝' :
                                 file.type.includes('excel') || file.type.includes('spreadsheet') ? '📊' :
                                 file.type.includes('powerpoint') || file.type.includes('presentation') ? '📑' :
                                 '📎'}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSelectedFile(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                              disabled={uploading}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {uploading && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-600 mb-2">Uploading files...</div>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  uploadProgress[index] === 'completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
                                }`}
                                style={{ width: uploadProgress[index] === 'completed' ? '100%' : '50%' }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {uploadProgress[index] === 'completed' ? 'Done' : 'Uploading...'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? 'Creating Task...' : 'Create Task'}
                </button>
              </div>
            </form>

            {createdTaskId && taskFiles.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Uploaded Files</h3>
                  <FileList
                    taskId={createdTaskId}
                    files={taskFiles}
                    onFileDeleted={(fileId) => {
                      setTaskFiles(prev => prev.filter(f => f._id !== fileId));
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Work Type Modal */}
      {isWorkTypeModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 work-type-modal">
          <div className="bg-white rounded-lg p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6">Add New Work Type</h2>
            <form onSubmit={handleWorkTypeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Type Name
                </label>
                <input
                  type="text"
                  value={workTypeFormData.name}
                  onChange={(e) => setWorkTypeFormData({ ...workTypeFormData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWorkTypeModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add Work Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateTask; 