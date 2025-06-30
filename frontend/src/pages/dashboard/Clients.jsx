import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';

const Clients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isWorkTypeModalOpen, setIsWorkTypeModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    status: 'Individual',
    workOffered: []
  });
  const [groupFormData, setGroupFormData] = useState({
    name: ''
  });
  const [workTypeFormData, setWorkTypeFormData] = useState({
    name: ''
  });

  const fetchClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setClients(data);
    } catch (error) {
      toast.error('Failed to fetch clients');
    }
  };

  const fetchClientGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/groups`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setClientGroups(data);
    } catch (error) {
      toast.error('Failed to fetch client groups');
    }
  };

  const fetchWorkTypes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/work-types`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setWorkTypes(data);
    } catch (error) {
      toast.error('Failed to fetch work types');
    }
  };

  useEffect(() => {
    fetchClients();
    fetchClientGroups();
    fetchWorkTypes();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      await fetchClients();
      setIsModalOpen(false);
      setFormData({
        name: '',
        group: '',
        status: 'Individual',
        workOffered: []
      });
      toast.success('Client created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(groupFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to create client group');
      }

      await fetchClientGroups();
      setIsGroupModalOpen(false);
      setGroupFormData({
        name: ''
      });
      toast.success('Client group created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleWorkTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/work-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(workTypeFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to create work type');
      }

      await fetchWorkTypes();
      setIsWorkTypeModalOpen(false);
      setWorkTypeFormData({
        name: ''
      });
      toast.success('Work type created successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      await fetchClients();
      toast.success('Client deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Redirect Fresher users
  if (user.role === 'Fresher') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  if (!['Admin', 'Head', 'Team Head'].includes(user.role)) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
          <p className="text-sm text-gray-600 mt-1">Manage client and client group information.</p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={() => { setIsModalOpen(true); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Add Client
          </button>
          <button
            onClick={() => { setIsGroupModalOpen(true); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            Add Group
          </button>
        </div>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          {clientGroups.map((group) => {
            const groupClients = clients.filter(client => client.group._id === group._id);
            return (
              <div key={group._id} className="mb-4 border border-gray-200 rounded-lg shadow-sm bg-white">
                <div className="bg-gray-100 px-4 py-2 rounded-t-lg border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800 tracking-wide">{group.name}</h3>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="w-1/4 px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="w-1/6 px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="w-1/3 px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Offered</th>
                        <th className="w-20 px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {groupClients.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-sm">No clients in this group.</td>
                        </tr>
                      ) : (
                        groupClients.map((client) => (
                          <tr key={client._id}>
                            <td className="w-1/4 px-4 py-2">
                              <div className="w-32 overflow-x-auto whitespace-nowrap scrollbar-hide text-sm">{client.name}</div>
                            </td>
                            <td className="w-1/6 px-4 py-2">
                              <div className="w-24 overflow-x-auto whitespace-nowrap scrollbar-hide text-sm">{client.status}</div>
                            </td>
                            <td className="w-1/3 px-4 py-2">
                              <div className="w-48 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                <div className="flex flex-wrap gap-1">
                                  {client.workOffered.map((work) => (
                                    <span
                                      key={work._id}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                                    >
                                      {work.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="w-20 px-4 py-2 whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteClient(client._id)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Delete client"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Client</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Group
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="flex-1 border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Select a group</option>
                    {clientGroups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsGroupModalOpen(true)}
                    className="bg-gray-100 px-3 py-2 rounded-md hover:bg-gray-200"
                  >
                    New Group
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="Individual">Individual</option>
                  <option value="Firm">Firm</option>
                  <option value="Company">Company</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Offered
                </label>
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setFormData({
                          ...formData,
                          workOffered: [...formData.workOffered, e.target.value]
                        });
                      }
                    }}
                    className="flex-1 border rounded-md px-3 py-2"
                  >
                    <option value="">Select work type</option>
                    {workTypes
                      .filter(workType => !formData.workOffered.includes(workType._id))
                      .map((workType) => (
                        <option key={workType._id} value={workType._id}>
                          {workType.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsWorkTypeModalOpen(true)}
                    className="bg-gray-100 px-3 py-2 rounded-md hover:bg-gray-200"
                  >
                    New Work Type
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.workOffered.map((workId) => {
                    const workType = workTypes.find(wt => wt._id === workId);
                    return workType ? (
                      <span
                        key={workId}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {workType.name}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            workOffered: formData.workOffered.filter(id => id !== workId)
                          })}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
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
                  Add Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Client Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Client Group</h2>
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Work Type Modal */}
      {isWorkTypeModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
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
                  className="w-full border rounded-md px-3 py-2"
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
    </div>
  );
};

export default Clients; 