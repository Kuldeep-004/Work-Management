import { useMemo, useCallback } from 'react';

const useTaskHandlers = (onStatusChange, onVerificationStatusChange, onTaskSelect) => {
  const handleStatusChange = useCallback((taskId, newStatus) => {
    onStatusChange?.(taskId, newStatus);
  }, [onStatusChange]);

  const handleVerificationStatusChange = useCallback((taskId, newStatus) => {
    onVerificationStatusChange?.(taskId, newStatus);
  }, [onVerificationStatusChange]);

  const handleTaskSelect = useCallback((taskId, selected) => {
    onTaskSelect?.(taskId, selected);
  }, [onTaskSelect]);

  return {
    handleStatusChange,
    handleVerificationStatusChange,
    handleTaskSelect
  };
};

export const useTaskRenderingLogic = (props) => {
  const {
    tasks,
    onStatusChange,
    onVerificationStatusChange,
    onTaskSelect
  } = props;

  // Handlers
  const handlers = useTaskHandlers(onStatusChange, onVerificationStatusChange, onTaskSelect);

  // Memoized tasks
  const memoizedTasks = useMemo(() => tasks, [JSON.stringify(tasks)]);

  // Batch size for progressive loading
  const BATCH_SIZE = 25;

  // Memoize the displayed tasks
  const displayedTasks = useMemo(() => {
    // Initially show first batch
    if (tasks.length <= BATCH_SIZE) {
      return tasks;
    }
    
    // Return all tasks after the initial render
    return tasks;
  }, [tasks, BATCH_SIZE]);

  return {
    ...handlers,
    displayedTasks,
    memoizedTasks
  };
};
