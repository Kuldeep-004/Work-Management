import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';

function formatDate(date) {
  if (!date) return 'NA';
  const d = new Date(date);
  return isNaN(d) ? 'NA' : d.toLocaleDateString();
}

const TaskListAssigned = ({ viewType = 'assigned' }) => {
  // ... (copy the entire body of TaskList, but replace TaskList with TaskListAssigned)
  // You may want to default viewType to 'assigned' if not provided
  const handleFileUploaded = (uploadedFiles) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t._id === selectedTask._id
          ? { ...t, files: [...(t.files || []), ...uploadedFiles] }
          : t
      )
    );
    setSelectedTask(prev =>
      prev && prev._id === selectedTask._id
        ? { ...prev, files: [...(prev.files || []), ...uploadedFiles] }
        : prev
    );
  };
  return (
     <div className="space-y-4">
    <div className="flex justify-between items-center mb-4 space-x-4">
      <input
        type="text"
        placeholder="Search tasks..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select
        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <select
        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
      >
        <option value="createdAt">Assigned On</option>
        <option value="priority">Priority</option>
        <option value="status">Status</option>
        <option value="clientName">Client Name</option>
        <option value="clientGroup">Client Group</option>
      </select>
      <button
        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        {sortOrder === 'asc' ? 'Asc' : 'Desc'}
      </button>
    </div>

    <div className="overflow-x-auto w-full">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client Group
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Work Type
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Verification Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Priority
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Inward Entry Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Target Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Assigned By
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Assigned To
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Files
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Comments
            </th>
            {viewType !== 'received' && (
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {getFilteredAndSortedTasks().map((task) => (
            <tr key={task._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{task.title}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{task.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{task.clientName}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{task.clientGroup}</div>
              </td>
              <td className="px-6 py-4">
                <div className="flex overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">
                  {task.workType && task.workType.map((type, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  {task.assignedTo._id === loggedInUser._id ? (
                    <select
                      value={task.status || 'pending'}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}>
                      {task.status ? task.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Pending'}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  {(task.assignedTo._id === loggedInUser._id || 
                    task.verificationAssignedTo?._id === loggedInUser._id || 
                    task.secondVerificationAssignedTo?._id === loggedInUser._id) ? (
                    <select
                      value={task.verificationStatus }
                      onChange={(e) => handleVerificationStatusChange(task._id, e.target.value)}
                      className={`px-2 py-1 rounded text-sm ${
                        task.verificationStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        task.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                        task.verificationStatus === 'first_verified' ? 'bg-blue-100 text-blue-800' :
                        task.verificationStatus === 'executed' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {getAllowedVerificationStatuses(task, loggedInUser).map(status => (
                        <option key={status} value={status}>
                          {status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded text-sm ${
                      task.verificationStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      task.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                      task.verificationStatus === 'first_verified' ? 'bg-blue-100 text-blue-800' :
                      task.verificationStatus === 'executed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.verificationStatus ? task.verificationStatus.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Pending'}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  task.priority === 'high' ? 'bg-red-100 text-red-800' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {task.priority}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(task.inwardEntryDate).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(task.dueDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(task.targetDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  {task.assignedBy ? (
                    <>
                      <img
                        src={task.assignedBy.photo?.url || defaultProfile}
                        alt={`${task.assignedBy.firstName} ${task.assignedBy.lastName}`}
                        className="h-8 w-8 rounded-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = defaultProfile;
                        }}
                      />
                      <span>{`${task.assignedBy.firstName} ${task.assignedBy.lastName}`}</span>
                    </>
                  ) : (
                    <span>N/A</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  {task.assignedTo ? (
                    Array.isArray(task.assignedTo) ? (
                      <div className="flex -space-x-2">
                        {task.assignedTo.map((user, index) => (
                          <div key={user._id} className="relative group">
                            <img
                              src={user.photo?.url || defaultProfile}
                              alt={`${user.firstName} ${user.lastName}`}
                              className="h-8 w-8 rounded-full object-cover border-2 border-white"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = defaultProfile;
                              }}
                            />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {`${user.firstName} ${user.lastName}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <img
                          src={task.assignedTo.photo?.url || defaultProfile}
                          alt={`${task.assignedTo.firstName} ${task.assignedTo.lastName}`}
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = defaultProfile;
                          }}
                        />
                        <span>{`${task.assignedTo.firstName} ${task.assignedTo.lastName}`}</span>
                      </>
                    )
                  ) : (
                    <span>Unassigned</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  {task.files && task.files.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-600">{task.files.length}</span>
                      <span className="text-gray-500">files</span>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowFileUpload(true);
                          setShowComments(false);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm italic">No files</span>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowFileUpload(true);
                          setShowComments(false);
                        }}
                        className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {task.comments ? task.comments.length : 0} comments
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setShowComments(true);
                      setShowFileUpload(false);
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View
                  </button>
                </div>
              </td>
              {viewType !== 'received' && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {tasks.length > 0 && (
                    <div className="flex items-center space-x-2">
                      {viewType === 'assigned' ? (
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-gray-500 italic">View only</span>
                      )}
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Verification Modal */}
    {showVerificationModal && selectedTaskForVerification && (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-medium mb-4">
            {verificationStage === 'first' ? 'Assign First Verifier' : 'Assign Second Verifier'}
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Verifier
            </label>
            <select
              value={selectedTaskForVerification.verificationAssignedTo || ''}
              onChange={(e) => {
                const selectedUserId = e.target.value;
                setSelectedTaskForVerification({
                  ...selectedTaskForVerification,
                  verificationAssignedTo: selectedUserId
                });
              }}
              className="w-full border rounded-md px-3 py-2 bg-white"
              required
            >
              <option value="">Select Verifier</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setShowVerificationModal(false);
                setSelectedTaskForVerification(null);
                setVerificationStage('first');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleRequestVerification(selectedTaskForVerification._id)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {verificationStage === 'first' ? 'Assign First Verifier' : 'Assign Second Verifier'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Complete Confirmation Modal */}
    {showCompleteModal && selectedTaskForComplete && (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white/95 rounded-lg p-6 max-w-md w-full shadow-xl">
          <h3 className="text-lg font-medium mb-4">Complete Task</h3>
          <p className="mb-4">Are you sure you want to mark this task as completed?</p>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setShowCompleteModal(false);
                setSelectedTaskForComplete(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCompleteTask(selectedTaskForComplete._id)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Complete Task
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Task details modal */}
    {selectedTask && (showFileUpload || showComments) && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {showFileUpload ? 'Task Details' : 'Task Comments'}
            </h2>
            <button
              onClick={() => {
                setSelectedTask(null);
                setShowFileUpload(false);
                setShowComments(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {showFileUpload ? (
              <>
                {/* Task details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-gray-700">Title</h3>
                    <p className="text-gray-900">{selectedTask.title}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">Status</h3>
                    <p className="text-gray-900">{selectedTask.status}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">Priority</h3>
                    <p className="text-gray-900">{selectedTask.priority}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">Due Date</h3>
                    <p className="text-gray-900">
                      {formatDate(selectedTask.dueDate)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <h3 className="font-medium text-gray-700">Description</h3>
                    <p className="text-gray-900">{selectedTask.description}</p>
                  </div>
                </div>

                {/* File upload section */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Files</h3>
                  <FileUpload
                    taskId={selectedTask._id}
                    onFileUploaded={handleFileUploaded}
                    onFileDeleted={handleFileDeleted}
                  />
                  {selectedTask.files && selectedTask.files.length > 0 && (
                    <div className="mt-4">
                      <FileList
                        taskId={selectedTask._id}
                        files={selectedTask.files}
                        onFileDeleted={handleFileDeleted}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="border-t pt-4">
                <TaskComments taskId={selectedTask._id} />
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Verifier Selection Modal */}
    {showVerifierModal && selectedTaskForVerifier && (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-medium mb-4">Assign Task for Verification</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Verifier
            </label>
            <select
              value={selectedTaskForVerifier.verificationAssignedTo || ''}
              onChange={(e) => {
                const selectedUserId = e.target.value;
                setSelectedTaskForVerifier({
                  ...selectedTaskForVerifier,
                  verificationAssignedTo: selectedUserId
                });
              }}
              className="w-full border rounded-md px-3 py-2 bg-white"
              required
            >
              <option value="">Select Verifier</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setShowVerifierModal(false);
                setSelectedTaskForVerifier(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVerifierAssignment(selectedTaskForVerifier._id, selectedTaskForVerifier.verificationAssignedTo)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Assign Verifier
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Second Verifier Selection Modal */}
    {showSecondVerifierModal && selectedTaskForVerifier && (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-medium mb-4">Assign Second Verifier</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Second Verifier
            </label>
            <select
              value={selectedTaskForVerifier.secondVerificationAssignedTo || ''}
              onChange={(e) => {
                const selectedUserId = e.target.value;
                setSelectedTaskForVerifier({
                  ...selectedTaskForVerifier,
                  secondVerificationAssignedTo: selectedUserId
                });
              }}
              className="w-full border rounded-md px-3 py-2 bg-white"
              required
            >
              <option value="">Select Second Verifier</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setShowSecondVerifierModal(false);
                setSelectedTaskForVerifier(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVerifierAssignment(
                selectedTaskForVerifier._id, 
                selectedTaskForVerifier.secondVerificationAssignedTo,
                true
              )}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Assign Second Verifier
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default TaskListAssigned; 