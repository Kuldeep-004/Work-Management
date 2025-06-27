import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Analytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    priorityDistribution: {
      urgent: 0,
      regular: 0,
      inOneWeek: 0,
      inFifteenDays: 0,
      inOneMonth: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/tasks', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        const tasks = await response.json();

        const stats = {
          totalTasks: tasks.length,
          completedTasks: tasks.filter((task) => task.status === 'completed').length,
          pendingTasks: tasks.filter((task) => task.status === 'pending').length,
          inProgressTasks: tasks.filter((task) => task.status === 'in_progress').length,
          priorityDistribution: {
            urgent: tasks.filter((task) => task.priority === 'urgent').length,
            regular: tasks.filter((task) => task.priority === 'regular').length,
            inOneWeek: tasks.filter((task) => task.priority === 'inOneWeek').length,
            inFifteenDays: tasks.filter((task) => task.priority === 'inFifteenDays').length,
            inOneMonth: tasks.filter((task) => task.priority === 'inOneMonth').length,
          },
        };

        setStats(stats);
      } catch (error) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Task Status Cards */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Tasks</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completedTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">In Progress</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.inProgressTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Pending</h3>
          <p className="text-3xl font-bold text-red-600">{stats.pendingTasks}</p>
        </div>

        {/* Priority Distribution */}
        <div className="col-span-full bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Priority Distribution</h3>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.priorityDistribution.urgent}
              </div>
              <div className="text-sm text-gray-600">Urgent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats.priorityDistribution.regular}
              </div>
              <div className="text-sm text-gray-600">Regular</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
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