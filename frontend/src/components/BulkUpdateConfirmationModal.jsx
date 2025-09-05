import React, { useState } from 'react';
import { toast } from 'react-toastify';

const BulkUpdateConfirmationModal = ({ 
  isOpen, 
  onClose, 
  operation, // 'status' or 'priority'
  oldValue, 
  newValue, 
  previewData,
  onConfirm 
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const requiredConfirmationText = 'CONFIRM BULK UPDATE';

  const handleConfirm = async () => {
    if (confirmationText !== requiredConfirmationText) {
      toast.error(`Please type "${requiredConfirmationText}" exactly to confirm`);
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm();
      setConfirmationText('');
      onClose();
    } catch (error) {
      toast.error('Failed to perform bulk update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-red-600 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              DANGER: Bulk Update Confirmation
            </h2>
            <button 
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  This action cannot be undone!
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  You are about to change the {operation} name from "<strong>{oldValue}</strong>" to "<strong>{newValue}</strong>".
                  This will affect <strong>{previewData?.affectedTasksCount || 0}</strong> tasks across your entire system.
                </p>
              </div>
            </div>
          </div>

          {/* Preview Data */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Impact Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-600">Operation:</span>
                  <div className="font-semibold">Update {operation} name</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Affected Tasks:</span>
                  <div className="font-semibold text-red-600">{previewData?.affectedTasksCount || 0}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">From:</span>
                  <div className="font-mono bg-red-100 text-red-800 px-2 py-1 rounded text-sm">{oldValue}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">To:</span>
                  <div className="font-mono bg-green-100 text-green-800 px-2 py-1 rounded text-sm">{newValue}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Tasks */}
          {previewData?.sampleTasks && previewData.sampleTasks.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">
                Sample Affected Tasks {previewData.affectedTasksCount > 10 && `(showing 10 of ${previewData.affectedTasksCount})`}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {previewData.sampleTasks.map((task, index) => (
                    <div key={task.id} className="bg-white rounded border p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
                          <p className="text-sm text-gray-600">Client: {task.clientName}</p>
                          <p className="text-sm text-gray-600">Assigned to: {task.assignedTo}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type "<strong>{requiredConfirmationText}</strong>" to confirm this dangerous action:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                confirmationText === requiredConfirmationText 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-gray-300'
              }`}
              placeholder={requiredConfirmationText}
              autoComplete="off"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || confirmationText !== requiredConfirmationText}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Confirm Bulk Update'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateConfirmationModal;
