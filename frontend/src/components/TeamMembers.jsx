import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import { API_BASE_URL } from '../apiConfig';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const TeamMembers = () => {
  // Delete Team handler
  const handleDeleteTeam = async (teamName) => {
    const team = teams.find(t => t.name === teamName);
    if (!team) {
      toast.error('Team not found');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/${team._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to delete team');
      }
      setTeams(prev => prev.filter(t => t._id !== team._id));
      setDeleteConfirm({ show: false, teamName: '' });
      toast.success('Team deleted successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to delete team');
    }
  };
  // Add Team handler
  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newTeamName.trim() })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add team');
      }
      const createdTeam = await response.json();
      setTeams((prev) => [...prev, createdTeam]);
      setShowAddTeamModal(false);
      setNewTeamName('');
      toast.success('Team added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add team');
    }
  };
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [expandedTeams, setExpandedTeams] = useState({});
  const [editingTeam, setEditingTeam] = useState(null);
  const [editedTeamName, setEditedTeamName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, teamName: '' });
  const gridRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`, {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }),
          fetch(`${API_BASE_URL}/api/teams`, {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          })
        ]);

        if (!usersRes.ok || !teamsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const usersData = await usersRes.json();
        const teamsData = await teamsRes.json();
        if (!Array.isArray(usersData) || !Array.isArray(teamsData)) {
          throw new Error('Invalid data format received');
        }
        const validUsers = usersData.filter(member => 
          member && 
          typeof member === 'object' && 
          member.firstName && 
          member.lastName && 
          member.email
        );
        setUsers(validUsers);
        setTeams(teamsData);
        setError(null);
      } catch (error) {
        setError(error.message);
        toast.error('Failed to fetch team members');
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (Object.values(expandedTeams).some(Boolean)) {
      const handleClickOutside = (event) => {
        if (gridRef.current && !gridRef.current.contains(event.target)) {
          setExpandedTeams({});
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expandedTeams]);

  // Group users by team (restore old logic)
  const groupUsersByTeam = (usersArray) => {
    const allTeams = teams.reduce((acc, team) => {
      acc[team.name] = [];
      return acc;
    }, {
      'Admin': [],
      'Team Head': [],
      'Senior': [],
      'Fresher': [],
    });
    usersArray.forEach(user => {
      if (user.role === 'Admin') {
        allTeams['Admin'].push(user);
      } else if (user.role === 'Team Head') {
        allTeams['Team Head'].push(user);
      } else if (user.role === 'Senior') {
        allTeams['Senior'].push(user);
      } else if (user.role === 'Fresher') {
        allTeams['Fresher'].push(user);
      }
    });
    teams.forEach(team => {
      if (!['Admin', 'Team Head', 'Senior', 'Fresher'].includes(team.name)) {
        allTeams[team.name] = usersArray.filter(user => user.team === team._id);
      }
    });
    return allTeams;
  };

  const groupedUsers = groupUsersByTeam(users);
  const mainTeams = ['Admin', 'Team Head', 'Senior', 'Fresher'];
  const otherTeams = Object.keys(groupedUsers).filter(teamName => !mainTeams.includes(teamName));

  // Sort users in a team
  const sortTeamUsers = (users) => {
    const order = { 'Team Head': 1, 'Senior': 2, 'Fresher': 3 };
    return [...users].sort((a, b) => {
      const aOrder = order[a.role] || 99;
      const bOrder = order[b.role] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName);
    });
  };

  const startEditingTeam = (teamName) => {
    setEditingTeam(teamName);
    setEditedTeamName(teamName);
  };
  const cancelEditingTeam = () => {
    setEditingTeam(null);
    setEditedTeamName('');
  };
  const confirmDeleteTeam = (teamName) => {
    setDeleteConfirm({ show: true, teamName });
  };
  const cancelDeleteTeam = () => {
    setDeleteConfirm({ show: false, teamName: '' });
  };

  // For static teams, only one can be open at a time
  const handleStaticTeamToggle = (teamName) => {
    setExpandedTeams(prev => {
      const newState = {};
      if (!prev[teamName]) {
        newState[teamName] = true;
      }
      return newState;
    });
  };

  // For custom teams, allow multiple open
  const handleCustomTeamToggle = (teamName) => {
    setExpandedTeams(prev => ({ ...prev, [teamName]: !prev[teamName] }));
  };

  // Save edited team name for custom teams
  const handleSaveEditTeam = async (oldName) => {
    const team = teams.find(t => t.name === oldName);
    if (!team) {
      toast.error('Team not found');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/${team._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: editedTeamName }),
      });
      if (!response.ok) {
        throw new Error('Failed to update team name');
      }
      const updatedTeam = await response.json();
      setTeams(prev => prev.map(t => t._id === updatedTeam._id ? updatedTeam : t));
      setEditingTeam(null);
      setEditedTeamName('');
      toast.success('Team name updated');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500 text-center">
          <p className="text-lg font-semibold">Error loading team members</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500 text-center">
          <p className="text-lg font-semibold">No team members found</p>
          <p className="text-sm">Add team members to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-[#f8f9fa]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold text-gray-900 tracking-tight">Members</h2>
        {user?.role === 'Admin' && (
          <button
            onClick={() => setShowAddTeamModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 text-sm font-medium"
          >
            Add Team
          </button>
        )}
      </div>

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 bg-gray-600/30 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white z-60">
            <div className="mt-3">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Add New Team</h3>
              <form onSubmit={handleAddTeam}>
                <div className="mb-4">
                  <label htmlFor="teamName" className="block text-sm font-medium text-gray-700">
                    Team Name
                  </label>
                  <input
                    type="text"
                    id="teamName"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddTeamModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create Team
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main 4 Teams Row */}
      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {mainTeams.map((teamName) => {
          const members = groupedUsers[teamName] || [];
          const isExpanded = expandedTeams[teamName] || false;
          return (
            <div key={teamName} className="relative">
              <button
                onClick={() => handleStaticTeamToggle(teamName)}
                className={`w-full flex justify-between items-center px-4 py-3 text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-150 ${isExpanded ? 'ring-2 ring-blue-100' : 'hover:shadow-md hover:bg-gray-50'}`}
                style={{ minHeight: '48px' }}
              >
                <span>{teamName} <span className="text-gray-400 font-normal">({members.length})</span></span>
                {isExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {isExpanded && (
                <div className="absolute left-0 top-full w-full z-20 bg-white border border-gray-200 shadow-xl rounded-xl mt-2 max-h-80 overflow-y-auto animate-fadeIn p-2">
                  {members.length > 0 ? (
                    <div className="space-y-1">
                      {sortTeamUsers(members).map((member) => (
                        <div
                          key={member._id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <img 
                            src={member.photo?.url || defaultProfile} 
                            alt={`${member.firstName} ${member.lastName}`}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {member.firstName} {member.lastName}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">{member.email}</p>
                            <p className="text-xs text-gray-400">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm text-center py-4">No members in this team</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Other Teams */}
      {otherTeams.length > 0 && (
        <div className="mt-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 tracking-tight">Teams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {otherTeams.map((teamName) => {
              const members = groupedUsers[teamName] || [];
              const isExpanded = expandedTeams[teamName] || false;
              const isEditing = editingTeam === teamName;
              return (
                <div key={teamName} className="relative">
                  <div className="w-full flex justify-between items-center px-4 py-3 text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-150 hover:shadow-md hover:bg-gray-50" style={{ minHeight: '48px' }}>
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editedTeamName}
                          autoFocus
                          onChange={e => setEditedTeamName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEditTeam(teamName);
                            if (e.key === 'Escape') cancelEditingTeam();
                          }}
                          onBlur={cancelEditingTeam}
                          className="w-full max-w-[120px] rounded px-2 py-1 border border-blue-300 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm font-medium text-gray-900 transition"
                          style={{ minWidth: 0 }}
                          placeholder="Team name"
                        />
                        <button
                          onClick={cancelEditingTeam}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded transition flex items-center justify-center"
                          tabIndex={-1}
                          type="button"
                          aria-label="Cancel"
                          style={{ height: '24px', width: '24px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => handleCustomTeamToggle(teamName)}
                        className="flex-1 cursor-pointer truncate"
                      >
                        {teamName} <span className="text-gray-400 font-normal">({members.length})</span>
                      </span>
                    )}
                    {user?.role === 'Admin' && (
                      <div className="flex items-center space-x-2">
                        {!isEditing ? (
                          <>
                            <button onClick={() => { setEditingTeam(teamName); setEditedTeamName(teamName); }} className="text-blue-500 hover:text-blue-700"><PencilIcon className="w-5 h-5" /></button>
                            <button onClick={() => confirmDeleteTeam(teamName)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5" /></button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="absolute left-0 top-full w-full z-20 bg-white border border-gray-200 shadow-xl rounded-xl mt-2 max-h-80 overflow-y-auto animate-fadeIn p-2">
                      {members.length > 0 ? (
                        <div className="space-y-1">
                          {sortTeamUsers(members).map((member) => (
                            <div
                              key={member._id}
                              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <img 
                                src={member.photo?.url || defaultProfile} 
                                alt={`${member.firstName} ${member.lastName}`}
                                className="w-7 h-7 rounded-full object-cover border border-gray-200"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-medium text-gray-900 truncate">
                                  {member.firstName} {member.lastName}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                <p className="text-xs text-gray-400">{member.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs text-center py-4">No members in this team</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-gray-600/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h4 className="text-lg font-semibold mb-4">Delete Team</h4>
            <p>Are you sure you want to delete the team <span className="font-bold">{deleteConfirm.teamName}</span>?</p>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={cancelDeleteTeam} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
              <button onClick={() => handleDeleteTeam(deleteConfirm.teamName)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembers; 