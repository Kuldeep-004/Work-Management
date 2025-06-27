import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, TrashIcon, CheckIcon, CalendarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig.js';

const TodoList = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'regular',
    dueDate: '',
    status: 'pending'
  });
  const modalRef = useRef(null);

  // Allowed priorities and statuses for robust enum handling
  const PRIORITIES = [
    { value: 'today', label: 'Today' },
    { value: 'lessThan3Days', label: '< 3 days' },
    { value: 'thisWeek', label: 'This week' },
    { value: 'thisMonth', label: 'This month' },
    { value: 'regular', label: 'Regular' },
    { value: 'filed', label: 'Filed' },
    { value: 'dailyWorksOffice', label: 'Daily works office' },
    { value: 'monthlyWorks', label: 'Monthly works' },
    { value: 'urgent', label: 'Urgent' },
  ];
  const STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/todos`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setTodos(data);
    } catch (error) {
      toast.error('Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [user]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create todo');
      }

      const newTodo = await response.json();
      setTodos([newTodo, ...todos]);
      setFormData({
        title: '',
        description: '',
        priority: 'regular',
        dueDate: '',
        status: 'pending'
      });
      setIsModalOpen(false);
      toast.success('Todo added successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    const statusFlow = {
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'pending'
    };

    const newStatus = statusFlow[currentStatus];
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      const updatedTodo = await response.json();
      setTodos(todos.map(todo =>
        todo._id === id ? updatedTodo : todo
      ));
      toast.success('Status updated successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete todo');
      }

      setTodos(todos.filter(todo => todo._id !== id));
      toast.success('Todo deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800'; // fallback for unknown
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'today':
        return 'bg-orange-100 text-orange-800';
      case 'lessThan3Days':
        return 'bg-yellow-100 text-yellow-800';
      case 'thisWeek':
        return 'bg-blue-100 text-blue-800';
      case 'thisMonth':
        return 'bg-purple-100 text-purple-800';
      case 'regular':
        return 'bg-gray-100 text-gray-800';
      case 'filed':
        return 'bg-pink-100 text-pink-800';
      case 'dailyWorksOffice':
        return 'bg-teal-100 text-teal-800';
      case 'monthlyWorks':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-200 text-gray-500'; // fallback for unknown
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-6 px-2 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-extrabold text-gray-900">My Todo List</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors text-base font-semibold"
          >
            <PlusIcon className="w-5 h-5" /> Add Todo
          </button>
        </div>
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {todos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center text-gray-400 text-lg">
                      <span className="inline-block mb-2">
                        <CheckIcon className="w-10 h-10 mx-auto text-gray-200" />
                      </span>
                      <br />No todos yet. Click <span className="font-semibold text-blue-600">Add Todo</span> to get started!
                    </td>
                  </tr>
                ) : (
                  todos.map((todo) => (
                    <tr key={todo._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="text-base font-semibold text-gray-900">{todo.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{todo.description}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm text-gray-900">{formatDate(todo.dueDate)}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(todo.priority)}`}> 
                          {PRIORITIES.find(p => p.value === todo.priority)?.label || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <button
                          onClick={() => handleStatusChange(todo._id, todo.status)}
                          className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getStatusColor(todo.status)} shadow-sm`}
                        >
                          {STATUSES.find(s => s.value === todo.status)?.label || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <button
                          onClick={() => handleDeleteTodo(todo._id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete Todo"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Add Todo Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalRef} className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-bold mb-6">Add New Todo</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Todo</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Add Todo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList; 