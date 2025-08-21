/**
 * Utility function to truncate task names for UI display
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
