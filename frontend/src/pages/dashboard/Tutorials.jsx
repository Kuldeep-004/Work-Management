import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, PlayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../apiConfig';

const Tutorials = () => {
  const { user } = useAuth();
  const [tutorialGroups, setTutorialGroups] = useState([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [isEditTutorialModalOpen, setIsEditTutorialModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editGroupId, setEditGroupId] = useState(null);
  const [editTutorialId, setEditTutorialId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [playingVideo, setPlayingVideo] = useState(null);
  
  const [groupFormData, setGroupFormData] = useState({
    name: ''
  });
  
  const [tutorialFormData, setTutorialFormData] = useState({
    title: '',
    youtubeUrl: '',
    group: ''
  });
  
  const [editGroupFormData, setEditGroupFormData] = useState({
    name: ''
  });
  
  const [editTutorialFormData, setEditTutorialFormData] = useState({
    title: '',
    youtubeUrl: '',
    group: ''
  });

  // Check if user can manage tutorials (Admin or Team Head)
  const canManage = user?.role === 'Admin' || user?.role === 'Team Head';

  const fetchTutorialGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/groups`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setTutorialGroups(data);
    } catch (error) {
      toast.error('Failed to fetch tutorial groups');
    }
  };

  useEffect(() => {
    fetchTutorialGroups();
  }, [user]);

  // Helper function to extract YouTube video ID from URL
  const getYouTubeVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Helper function to get YouTube thumbnail URL
  const getYouTubeThumbnail = (url) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  // Helper function to get YouTube embed URL
  const getYouTubeEmbedUrl = (url) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : null;
  };

  // Function to handle video play
  const handlePlayVideo = (tutorialId, youtubeUrl) => {
    setPlayingVideo({ id: tutorialId, embedUrl: getYouTubeEmbedUrl(youtubeUrl) });
  };

  // Function to stop video
  const handleStopVideo = () => {
    setPlayingVideo(null);
  };

  // Group Management Functions
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(groupFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to create group');
      }

      await fetchTutorialGroups();
      setIsGroupModalOpen(false);
      setGroupFormData({ name: '' });
      toast.success('Tutorial group created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditGroup = (group) => {
    setEditGroupId(group._id);
    setEditGroupFormData({ name: group.name });
    setIsEditGroupModalOpen(true);
  };

  const handleEditGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/groups/${editGroupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(editGroupFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to update group');
      }

      await fetchTutorialGroups();
      setIsEditGroupModalOpen(false);
      setEditGroupFormData({ name: '' });
      setEditGroupId(null);
      toast.success('Tutorial group updated successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group and all its tutorials?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to delete group');
      }

      await fetchTutorialGroups();
      toast.success('Tutorial group deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Tutorial Management Functions
  const handleTutorialSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(tutorialFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to create tutorial');
      }

      await fetchTutorialGroups();
      setIsTutorialModalOpen(false);
      setTutorialFormData({ title: '', youtubeUrl: '', group: '' });
      setSelectedGroupId(null);
      toast.success('Tutorial created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditTutorial = (tutorial) => {
    setEditTutorialId(tutorial._id);
    setEditTutorialFormData({
      title: tutorial.title,
      youtubeUrl: tutorial.youtubeUrl,
      group: tutorial.group._id
    });
    setIsEditTutorialModalOpen(true);
  };

  const handleEditTutorialSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/${editTutorialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(editTutorialFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to update tutorial');
      }

      await fetchTutorialGroups();
      setIsEditTutorialModalOpen(false);
      setEditTutorialFormData({ title: '', youtubeUrl: '', group: '' });
      setEditTutorialId(null);
      toast.success('Tutorial updated successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteTutorial = async (tutorialId) => {
    if (!window.confirm('Are you sure you want to delete this tutorial?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tutorials/${tutorialId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to delete tutorial');
      }

      await fetchTutorialGroups();
      toast.success('Tutorial deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openAddTutorialModal = (groupId) => {
    setSelectedGroupId(groupId);
    setTutorialFormData({ ...tutorialFormData, group: groupId });
    setIsTutorialModalOpen(true);
  };

  const toggleGroupExpansion = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
      // Stop any playing video when group is collapsed
      setPlayingVideo(null);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Filter groups based on search term
  const filteredGroups = tutorialGroups.filter(group => {
    const groupNameMatch = group.name.toLowerCase().includes(searchTerm.toLowerCase());
    const tutorialMatch = group.tutorials?.some(tutorial => 
      tutorial.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return groupNameMatch || tutorialMatch;
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200 w-full sm:w-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📚 Tutorials</h1>
          <p className="text-base text-gray-700 leading-relaxed">
            {canManage 
              ? 'Manage tutorial groups and videos for the team. Create, organize, and share knowledge effectively.'
              : 'Browse and watch tutorial videos. Expand your knowledge with our curated learning resources.'
            }
          </p>
        </div>
        {canManage && (
          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="flex-1 sm:flex-none px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Add Group
            </button>
          </div>
        )}
      </div>

      {/* Tutorial Groups */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No tutorial groups found.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group._id} className="bg-white rounded-lg shadow border border-gray-200">
              {/* Group Header */}
              <div 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleGroupExpansion(group._id)}
              >
                <div className="flex items-center space-x-3">
                  {expandedGroups.has(group._id) ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-600" />
                  )}
                  <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                  <span className="text-sm text-gray-500">
                    ({group.tutorials?.length || 0} videos)
                  </span>
                </div>
                {canManage && (
                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openAddTutorialModal(group._id)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Add tutorial"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEditGroup(group)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Edit group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.789l-4 1 1-4 12.362-12.302z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group._id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Delete group"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Group Content */}
              {expandedGroups.has(group._id) && (
                <div className="p-4">
                  {group.tutorials?.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No tutorials in this group yet.</p>
                      {canManage && (
                        <button
                          onClick={() => openAddTutorialModal(group._id)}
                          className="mt-2 text-blue-600 hover:text-blue-800"
                        >
                          Add the first tutorial
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                      {group.tutorials.map((tutorial) => (
                        <div key={tutorial._id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                          {/* Video Player or Thumbnail */}
                          {playingVideo?.id === tutorial._id ? (
                            <div className="relative">
                              <iframe
                                width="100%"
                                height="257"
                                src={playingVideo.embedUrl}
                                title={tutorial.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full"
                              ></iframe>
                              <button
                                onClick={handleStopVideo}
                                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70 transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="relative h-64 bg-gray-200">
                              <img
                                src={getYouTubeThumbnail(tutorial.youtubeUrl)}
                                alt={tutorial.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="absolute inset-0 bg-gray-300 flex items-center justify-center text-gray-500 text-sm" style={{display: 'none'}}>
                                Video Thumbnail
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <button
                                  onClick={() => handlePlayVideo(tutorial._id, tutorial.youtubeUrl)}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-3 transition-all duration-200 hover:scale-110 shadow-lg"
                                >
                                  <PlayIcon className="h-6 w-6" />
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Video Details */}
                          <div className="p-3">
                            <h4 className="font-medium text-gray-800 text-sm mb-2" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {tutorial.title}
                            </h4>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handlePlayVideo(tutorial._id, tutorial.youtubeUrl)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  ▶ Play Video
                                </button>
                                <a
                                  href={tutorial.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-gray-700 text-xs"
                                >
                                  (YouTube)
                                </a>
                              </div>
                              {canManage && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleEditTutorial(tutorial)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                    title="Edit tutorial"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.789l-4 1 1-4 12.362-12.302z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTutorial(tutorial._id)}
                                    className="text-red-600 hover:text-red-800 transition-colors"
                                    title="Delete tutorial"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Tutorial Group</h2>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Add Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tutorial Modal */}
      {isTutorialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Tutorial</h2>
            <form onSubmit={handleTutorialSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutorial Title
                </label>
                <input
                  type="text"
                  value={tutorialFormData.title}
                  onChange={(e) => setTutorialFormData({ ...tutorialFormData, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL
                </label>
                <input
                  type="url"
                  value={tutorialFormData.youtubeUrl}
                  onChange={(e) => setTutorialFormData({ ...tutorialFormData, youtubeUrl: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutorial Group
                </label>
                <select
                  value={tutorialFormData.group}
                  onChange={(e) => setTutorialFormData({ ...tutorialFormData, group: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select a group</option>
                  {tutorialGroups.map(group => (
                    <option key={group._id} value={group._id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsTutorialModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add Tutorial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Edit Tutorial Group</h2>
            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={editGroupFormData.name}
                  onChange={(e) => setEditGroupFormData({ ...editGroupFormData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditGroupModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Update Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tutorial Modal */}
      {isEditTutorialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Edit Tutorial</h2>
            <form onSubmit={handleEditTutorialSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutorial Title
                </label>
                <input
                  type="text"
                  value={editTutorialFormData.title}
                  onChange={(e) => setEditTutorialFormData({ ...editTutorialFormData, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL
                </label>
                <input
                  type="url"
                  value={editTutorialFormData.youtubeUrl}
                  onChange={(e) => setEditTutorialFormData({ ...editTutorialFormData, youtubeUrl: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutorial Group
                </label>
                <select
                  value={editTutorialFormData.group}
                  onChange={(e) => setEditTutorialFormData({ ...editTutorialFormData, group: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select a group</option>
                  {tutorialGroups.map(group => (
                    <option key={group._id} value={group._id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditTutorialModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Update Tutorial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tutorials;