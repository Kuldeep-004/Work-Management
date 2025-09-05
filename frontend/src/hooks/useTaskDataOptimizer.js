import { useState, useEffect, useCallback } from 'react';

export const useTaskDataOptimizer = (tasks = [], batchSize = 25) => {
  const [optimizedTasks, setOptimizedTasks] = useState([]);
  const [renderingComplete, setRenderingComplete] = useState(false);

  const optimizeTasks = useCallback(() => {
    if (!tasks.length) {
      setOptimizedTasks([]);
      setRenderingComplete(true);
      return;
    }

    // Show initial batch immediately
    setOptimizedTasks(tasks.slice(0, batchSize));

    // Use requestAnimationFrame for smooth rendering of remaining tasks
    if (tasks.length > batchSize) {
      requestAnimationFrame(() => {
        setOptimizedTasks(tasks);
        setRenderingComplete(true);
      });
    } else {
      setRenderingComplete(true);
    }
  }, [tasks, batchSize]);

  useEffect(() => {
    setRenderingComplete(false);
    optimizeTasks();
  }, [optimizeTasks]);

  return {
    optimizedTasks,
    renderingComplete
  };
};
