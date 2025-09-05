import { useState, useEffect, useRef, useCallback } from 'react';

export const useTaskOptimizer = (tasks = [], batchSize = 25) => {
  // States
  const [displayedTasks, setDisplayedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Refs
  const timeoutRef = useRef(null);
  const frameRef = useRef(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);

  // Update function
  const updateTasks = useCallback(() => {
    setIsLoading(true);
    // Show initial batch immediately
    setDisplayedTasks(tasks.slice(0, batchSize));

    if (tasks.length > batchSize) {
      // Use setTimeout to ensure DOM has updated
      timeoutRef.current = setTimeout(() => {
        frameRef.current = requestAnimationFrame(() => {
          setDisplayedTasks(tasks);
          setIsLoading(false);
        });
      }, 16);
    } else {
      setIsLoading(false);
    }
  }, [tasks, batchSize]);

  // Effect for task updates
  useEffect(() => {
    cleanup();
    updateTasks();
    return cleanup;
  }, [updateTasks, cleanup]);

  return {
    tasks: displayedTasks,
    isLoading
  };
};
