import React, { useState, useRef, useEffect } from 'react';

const VerificationRemarksModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  task, 
  verificationType, // 'accepted' or 'rejected'
  loading = false 
}) => {
  const [remarks, setRemarks] = useState('');
  const modalRef = useRef(null);
  const textAreaRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus on textarea when modal opens
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
        }
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      // Focus back on textarea if remarks are empty
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
      return;
    }
    onSubmit(trimmedRemarks);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        ref={modalRef} 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {verificationType === 'accepted' ? 'Accept Verification' : 'Reject Verification'}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Task: <span className="font-medium">{task?.title}</span>
          </p>
          <p className="text-sm text-gray-600">
            You are about to <span className={`font-medium ${verificationType === 'accepted' ? 'text-green-600' : 'text-red-600'}`}>
              {verificationType}
            </span> this task verification.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={textAreaRef}
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your remarks here... (required)"
              rows={4}
              disabled={loading}
              required
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
                !remarks.trim() ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {!remarks.trim() && (
              <p className="text-xs text-red-500 mt-1">
                Remarks are required
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Press Ctrl+Enter to submit quickly
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !remarks.trim()}
              className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                verificationType === 'accepted' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                verificationType === 'accepted' ? 'Accept' : 'Reject'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerificationRemarksModal;
