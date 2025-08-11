import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';

const UserApprovals = () => {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState({});
  const [selectedTeams, setSelectedTeams] = useState({});

  const roles = ['Fresher', 'Team Head', 'Senior']; // swapped

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/pending-approvals`, {
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

        setPendingUsers(usersData);
        setTeams(teamsData);
        setError(null);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
        toast.error('Failed to fetch pending approvals');
      } finally {
        setLoading(false);
      }
    };

    if (user && user.token) {
      fetchData();
    }
  }, [user]);

  const handleRoleChange = (userId, role) => {
    setSelectedRoles(prev => ({
      ...prev,
      [userId]: role
    }));

    // If role is Senior, find and set Senior team
    if (role === 'Senior') {
      const seniorTeam = teams.find(team => team.name === 'Senior');
      if (seniorTeam) {
        setSelectedTeams(prev => ({
          ...prev,
          [userId]: seniorTeam._id
        }));
      }
    } else {
      // Clear team selection if role changes from Senior
      setSelectedTeams(prev => {
        const newTeams = { ...prev };
        delete newTeams[userId];
        return newTeams;
      });
    }
  };

  const handleApproval = async (userId, status) => {
    try {
      if (status === 'approved') {
        // Check if role is selected
        if (!selectedRoles[userId]) {
          toast.error('Please select a role before approving');
          return;
        }

        // For non-Senior roles, check if team is selected
        if (selectedRoles[userId] !== 'Senior' && !selectedTeams[userId]) {
          toast.error('Please select a team before approving');
          return;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/approval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ 
          status,
          role: selectedRoles[userId],
          team: selectedRoles[userId] === 'Senior' ? null : selectedTeams[userId]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      // Remove the user from pending list
      setPendingUsers(pendingUsers.filter(user => user._id !== userId));
      
      // Clear selections for this user
      setSelectedRoles(prev => {
        const newRoles = { ...prev };
        delete newRoles[userId];
        return newRoles;
      });
      setSelectedTeams(prev => {
        const newTeams = { ...prev };
        delete newTeams[userId];
        return newTeams;
      });

      toast.success(`User ${status} successfully`);
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
          <p className="text-lg font-semibold">Error loading pending approvals</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (pendingUsers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500 text-center">
          <p className="text-lg font-semibold">No pending approvals</p>
          <p className="text-sm">All users have been processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Pending User Approvals</h2>
      <div className="grid gap-6">
        {pendingUsers.map((pendingUser) => (
          <div key={pendingUser._id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {pendingUser.firstName} {pendingUser.lastName}
                </h3>
                <p className="text-gray-600">{pendingUser.email}</p>
                <p className="text-sm text-gray-500">
                  Registered on: {new Date(pendingUser.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col space-y-4 min-w-[340px]">
                <div className="flex space-x-4">
                  <select
                    value={selectedRoles[pendingUser._id] || ''}
                    onChange={(e) => handleRoleChange(pendingUser._id, e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {selectedRoles[pendingUser._id] !== 'Senior' && (
                    <select
                      value={selectedTeams[pendingUser._id] || ''}
                      onChange={(e) => setSelectedTeams(prev => ({
                        ...prev,
                        [pendingUser._id]: e.target.value
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Team</option>
                      {teams
                        .filter(team => team.name !== 'Senior')
                        .map(team => (
                          <option key={team._id} value={team._id}>{team.name}</option>
                        ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-row space-x-4 w-full justify-center min-w-[220px]">
                  <button
                    onClick={() => handleApproval(pendingUser._id, 'approved')}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedRoles[pendingUser._id] || (selectedRoles[pendingUser._id] !== 'Senior' && !selectedTeams[pendingUser._id])}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproval(pendingUser._id, 'rejected')}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserApprovals; 