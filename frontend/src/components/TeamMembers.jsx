import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';

const TeamMembers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          fetch('http://localhost:5000/api/users', {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }),
          fetch('http://localhost:5000/api/teams', {
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
        
        // Validate the data structure
        if (!Array.isArray(usersData) || !Array.isArray(teamsData)) {
          throw new Error('Invalid data format received');
        }

        // Filter out any invalid user objects
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
        console.error('Error fetching data:', error);
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

  // Function to group users by their team
  const groupUsersByTeam = (usersArray) => {
    // First, create an object with all teams (including empty ones)
    const allTeams = teams.reduce((acc, team) => {
      acc[team.name] = [];
      return acc;
    }, {
      'Admin': [], // Add Admin team
      'Head': []  // Add Head section
    });

    // Then populate the teams with their members
    usersArray.forEach(user => {
      let teamName;
      
      // Handle admin users and head users
      if (user.role === 'Admin') {
        teamName = 'Admin';
      } else if (user.role === 'Head') {
        teamName = 'Head';
      } else if (user.team) {
        // For other users, check their team assignment
        const userTeam = teams.find(t => t._id === user.team);
        if (userTeam) {
          teamName = userTeam.name;
        }
      }

      // Only add user to team if they have a valid team assignment or are Admin/Head
      if (teamName && allTeams[teamName]) {
        allTeams[teamName].push(user);
      }
    });

    return allTeams;
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newTeamName }),
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      const newTeam = await response.json();
      // Update teams state with the new team
      setTeams(prevTeams => [...prevTeams, newTeam]);
      setShowAddTeamModal(false);
      setNewTeamName('');
      toast.success('Team created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteTeam = async (teamName) => {
    try {
      const team = teams.find(t => t.name === teamName);
      if (!team) {
        toast.error('Team not found');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teams/${team._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to delete team');
      }
      setTeams(prev => prev.filter(t => t._id !== team._id));
      toast.success('Team deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const groupedUsers = groupUsersByTeam(users);

  // Sort teams to show Admin team first, then other teams alphabetically
  const sortedTeamEntries = Object.entries(groupedUsers).sort(([teamA], [teamB]) => {
    if (teamA === 'Admin') return -1;
    if (teamB === 'Admin') return 1;
    return teamA.localeCompare(teamB);
  });

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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Team Members</h2>
        {user?.role === 'Admin' && (
          <button
            onClick={() => setShowAddTeamModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Team
          </button>
        )}
      </div>

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-600/30 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedTeamEntries.map(([teamName, members]) => (
          <div key={teamName} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="w-full flex justify-between items-center px-6 py-4 text-lg font-semibold text-gray-800 bg-gray-50 rounded-t-lg">
              <span>{teamName} ({members.length})</span>
              {user?.role === 'Admin' && teamName !== 'Admin' && teamName !== 'Head' && members.length === 0 && (
                <button
                  onClick={() => handleDeleteTeam(teamName)}
                  className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete Team
                </button>
              )}
            </div>
            <div className="border-t border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4">
                {members.map((member) => (
                  <div
                    key={member._id}
                    className="bg-gray-50 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-center space-x-3">
                      <img 
                        src={member.photo?.url || defaultProfile} 
                        alt={`${member.firstName} ${member.lastName}`}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                      <div>
                        <h4 className="text-md font-semibold text-gray-800">
                          {member.firstName} {member.lastName}
                        </h4>
                        <p className="text-sm text-gray-600 break-words">{member.email}</p>
                        <p className="text-xs text-gray-500 break-words">Role: {member.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamMembers; 