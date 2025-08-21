/**
 * Utility function to truncate task names for notifications
 * @param {string} taskName - The full task name
 * @param {number} maxWords - Maximum number of words to show (default: 6)
 * @returns {string} Truncated task name with ellipsis if needed
 */
export const truncateTaskName = (taskName, maxWords = 6) => {
  if (!taskName) return '';
  
  const words = taskName.trim().split(/\s+/);
  
  if (words.length <= maxWords) {
    return taskName;
  }
  
  return words.slice(0, maxWords).join(' ') + '...';
};

/**
 * Get verifier type based on which verifier field is being assigned
 * @param {string} verifierField - The field name (verificationAssignedTo, secondVerificationAssignedTo, etc.)
 * @returns {string} Human readable verifier type
 */
export const getVerifierType = (verifierField) => {
  switch (verifierField) {
    case 'verificationAssignedTo':
      return 'first';
    case 'secondVerificationAssignedTo':
      return 'second';
    case 'thirdVerificationAssignedTo':
      return 'third';
    case 'fourthVerificationAssignedTo':
      return 'fourth';
    case 'fifthVerificationAssignedTo':
      return 'fifth';
    default:
      return 'verification';
  }
};
