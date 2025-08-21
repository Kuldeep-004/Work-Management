import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';

const Analytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTasks: 0,
    executionTasks: 0,
    verificationTasks: 0,
    issuedForVerificationTasks: 0,
    priorityDistribution: {
      urgent: 0,
      today: 0,
      regular: 0,
      inOneWeek: 0,
      inFifteenDays: 0,
      inOneMonth: 0,
    },
  });
  const [guidanceCount, setGuidanceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch analytics summary
        const response = await fetch(`${API_BASE_URL}/api/tasks/analytics/data`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const analyticsData = await response.json();
        setStats(analyticsData);

        // Fetch all tasks for guidance count
        const allTasksRes = await fetch(`${API_BASE_URL}/api/tasks`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (allTasksRes.ok) {
          const allTasks = await allTasksRes.json();
          // Guidance: user is in guides and status is not completed
          const count = allTasks.filter(task =>
            Array.isArray(task.guides) &&
            task.guides.some(g => (g._id || g) === user._id) &&
            task.status !== 'completed'
          ).length;
          setGuidanceCount(count);
        } else {
          setGuidanceCount(0);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Task Status Cards */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Tasks</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Task For Execution</h3>
          <p className="text-3xl font-bold text-green-600">{stats.executionTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Task For Verification</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.verificationTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Issued for Verification</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.issuedForVerificationTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Task For Guidance</h3>
          <p className="text-3xl font-bold text-pink-600">{guidanceCount}</p>
        </div>

        {/* Priority Distribution */}
        <div className="col-span-full bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Priority Distribution</h3>
          <div className="grid grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.priorityDistribution.urgent}
              </div>
              <div className="text-sm text-gray-600">Urgent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.priorityDistribution.today}
              </div>
              <div className="text-sm text-gray-600">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats.priorityDistribution.regular}
              </div>
              <div className="text-sm text-gray-600">Regular</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.priorityDistribution.inOneWeek}
              </div>
              <div className="text-sm text-gray-600">1 Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.priorityDistribution.inFifteenDays}
              </div>
              <div className="text-sm text-gray-600">15 Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.priorityDistribution.inOneMonth}
              </div>
              <div className="text-sm text-gray-600">1 Month</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 