import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../../assets/avatar.jpg';
import { API_BASE_URL } from '../../apiConfig';

const rolesList = ['Admin', 'Head', 'Team Head', 'Fresher'];
const role2List = ['None', 'TimeSheet Verifier', 'Task Verifier'];

const AllUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        setUsers(usersData);
        setTeams(teamsData);
        setError(null);
      } catch (error) {
        setError(error.message);
        toast.error('Failed to fetch users or teams');
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) fetchData();
  }, [user]);

  const getTeamName = (teamId) => {
    if (!teamId) return '-';
    const team = teams.find(t => t._id === teamId);
    return team ? team.name : '-';
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      const requestBody = {
        status: newStatus,
        ...(newStatus === 'pending' && {
          role: 'Fresher'
        })
      };

      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/approval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      if (newStatus === 'pending') {
        setUsers(prev => prev.map(u => 
          u._id === userId 
            ? { ...u, status: newStatus, role: 'Fresher' } 
            : u
        ));
      }
      toast.success('User status updated successfully');
    } catch (err) {
      console.error('Error updating user status:', err);
      toast.error(err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/update-fields`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update user role');
      }

      setUsers(prev => prev.map(u =>
        u._id === userId
          ? { ...u, role: newRole, team: newRole === 'Head' ? null : u.team }
          : u
      ));
      toast.success('User role updated successfully');
    } catch (err) {
      console.error('Error updating user role:', err);
      toast.error(err.message);
    }
  };

  const handleTeamChange = async (userId, newTeamId) => {
    try {
      const targetUser = users.find(u => u._id === userId);
      if (!targetUser) {
        throw new Error('User not found');
      }

      if (targetUser.role === 'Head') {
        toast.error('Head role cannot be assigned to a team');
        return;
      }

      // If "Select Team" is chosen (empty string), set team to null
      const teamValue = newTeamId === '' ? null : newTeamId;

      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/update-fields`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ team: teamValue }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update user team');
      }

      const updatedUser = await res.json();
      setUsers(prev => prev.map(u =>
        u._id === userId ? updatedUser : u
      ));
      toast.success('User team updated successfully');
    } catch (err) {
      console.error('Error updating user team:', err);
      toast.error(err.message);
    }
  };

  const handleRole2Change = async (userId, newRole2) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/update-fields`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ role2: newRole2 }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update user role2');
      }

      setUsers(prev => prev.map(u =>
        u._id === userId
          ? { ...u, role2: newRole2 }
          : u
      ));
      toast.success('User role2 updated successfully');
    } catch (err) {
      console.error('Error updating user role2:', err);
      toast.error(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }

      setUsers(prev => prev.filter(u => u._id !== userId));
      toast.success('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error(err.message);
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
          <p className="text-lg font-semibold">Error loading users</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Sort: Admins first, then Head, then others alphabetically by team, then by name
  const sortedUsers = [...users]
    .filter(u => u.status === 'approved')
    .sort((a, b) => {
      if (a.role === 'Admin') return -1;
      if (b.role === 'Admin') return 1;
      const aTeam = getTeamName(a.team);
      const bTeam = getTeamName(b.team);
      if (aTeam === 'Head') return -1;
      if (bTeam === 'Head') return 1;
      if (aTeam !== bTeam) return aTeam.localeCompare(bTeam);
      return (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName);
    });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">All Users</h2>
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role1</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role2</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedUsers.map(u => (
              <tr key={u._id} className="border-b">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img 
                      src={u.photo?.url || defaultProfile} 
                      alt={`${u.firstName} ${u.lastName}`}
                      className="w-9 h-9 rounded-full object-cover mr-3"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {u.firstName} {u.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <select
                    value={u.role || ''}
                    onChange={e => handleRoleChange(u._id, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Select Role</option>
                    {rolesList.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600">
                  {user.role === 'Admin' ? (
                    <select
                      value={u.role2 || 'None'}
                      onChange={e => handleRole2Change(u._id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded"
                    >
                      {role2List.map(r2 => (
                        <option key={r2} value={r2}>{r2}</option>
                      ))}
                    </select>
                  ) : (
                    u.role2 || 'None'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <select
                    value={u.team || ''}
                    onChange={e => handleTeamChange(u._id, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded"
                    disabled={u.role === 'Head'}
                  >
                    <option value="">Select Team</option>
                    {teams.map(team => (
                      <option key={team._id} value={team._id}>{team.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <button
                    onClick={() => handleDeleteUser(u._id)}
                    className="text-red-600 hover:text-red-900"
                    disabled={u.role === 'Admin'}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllUsers; 