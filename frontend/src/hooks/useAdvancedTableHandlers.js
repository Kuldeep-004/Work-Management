import { useState, useCallback } from 'react';

export const useAdvancedTableHandlers = (props) => {
  const {
    onStatusChange,
    onVerificationStatusChange,
    onTaskSelect,
    onTaskUpdate,
    refetchTasks
  } = props;

  // All state hooks
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);

  // Task handlers
  const handleStatusChange = useCallback((taskId, newStatus) => {
    onStatusChange?.(taskId, newStatus);
  }, [onStatusChange]);

  const handleVerificationStatusChange = useCallback((taskId, newStatus) => {
    onVerificationStatusChange?.(taskId, newStatus);
  }, [onVerificationStatusChange]);

  const handleTaskSelect = useCallback((taskId, selected) => {
    onTaskSelect?.(taskId, selected);
  }, [onTaskSelect]);

  const handleEditTask = useCallback((task) => {
    setEditTask(task);
    setEditModalOpen(true);
  }, []);

  const handleTaskSubmit = useCallback(async (updatedOrCreated, isEdit = false) => {
    setEditModalOpen(false);
    const wasEdit = editTask !== null;
    setEditTask(null);
    
    if (updatedOrCreated && updatedOrCreated._id) {
      if (onTaskUpdate) {
        onTaskUpdate(updatedOrCreated._id, () => updatedOrCreated);
      }
      // Only refetch tasks for new task creation, not for updates
      if (refetchTasks && !wasEdit) {
        setTimeout(() => refetchTasks(), 200);
      }
    }
  }, [onTaskUpdate, refetchTasks, editTask]);

  return {
    // States
    editModalOpen,
    setEditModalOpen,
    editTask,
    setEditTask,
    
    // Handlers
    handleStatusChange,
    handleVerificationStatusChange,
    handleTaskSelect,
    handleEditTask,
    handleTaskSubmit
  };
};
