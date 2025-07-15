import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import toast from 'react-hot-toast';

const columns = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'priority', label: 'Priority' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'verificationAssignedTo', label: 'Verifier 1' },
  { id: 'secondVerificationAssignedTo', label: 'Verifier 2' },
  { id: 'thirdVerificationAssignedTo', label: 'Third Verifier' },
  { id: 'fourthVerificationAssignedTo', label: 'Fourth Verifier' },
  { id: 'fifthVerificationAssignedTo', label: 'Fifth Verifier' },
];

const TaskVerification = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/for-verification`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch tasks for verification');
        let data = await res.json();
        // Remove all logic and UI related to 'pending' status
        setTasks(data);
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) fetchTasks();
  }, [user]);

  const handleAction = async (taskId, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      toast.success(`Task ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Tasks Pending For Approval</h2>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : tasks.length === 0 ? (
        <div className="text-gray-500">No tasks pending verification.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => (
                  <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>
                ))}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {tasks.map(task => (
                <tr key={task._id}>
                  <td className="px-4 py-2 whitespace-nowrap">{task.title}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.description}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.clientName}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.clientGroup}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{Array.isArray(task.workType) ? task.workType.join(', ') : task.workType}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.priority}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.assignedBy?.firstName} {task.assignedBy?.lastName}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.assignedTo?.firstName} {task.assignedTo?.lastName}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : 'Unassigned'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : 'Unassigned'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.thirdVerificationAssignedTo ? `${task.thirdVerificationAssignedTo.firstName} ${task.thirdVerificationAssignedTo.lastName}` : 'Unassigned'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.fourthVerificationAssignedTo ? `${task.fourthVerificationAssignedTo.firstName} ${task.fourthVerificationAssignedTo.lastName}` : 'Unassigned'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{task.fifthVerificationAssignedTo ? `${task.fifthVerificationAssignedTo.firstName} ${task.fifthVerificationAssignedTo.lastName}` : 'Unassigned'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleAction(task._id, 'approve')}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded mr-2"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(task._id, 'reject')}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TaskVerification; 