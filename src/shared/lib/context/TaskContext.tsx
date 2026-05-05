'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface Task {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: string;
  results: any[];
  metadata?: any;
}

interface TaskContextType {
  tasks: Record<string, Task>;
  startTask: (id: string, runFn: (update: (data: Partial<Task>) => void) => Promise<void>) => void;
  getTask: (id: string) => Task | undefined;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const tasksRef = useRef<Record<string, Task>>(tasks);
  const taskStatusRef = useRef<Record<string, boolean>>({});
  const activeTaskIdsRef = useRef<Set<string>>(new Set());

  // Cập nhật ref mỗi khi tasks thay đổi
  useEffect(() => {
    tasksRef.current = tasks;
    
    // Cập nhật danh sách các task đang chạy
    const running = new Set<string>();
    Object.values(tasks).forEach(t => {
      if (t.status === 'running') running.add(t.id);
    });
    activeTaskIdsRef.current = running;
  }, [tasks]);

  // === HEARTBEAT & CLEANUP LOGIC ===
  useEffect(() => {
    // Heartbeat every 15 seconds
    const interval = setInterval(() => {
      activeTaskIdsRef.current.forEach(taskId => {
        fetch('http://localhost:8081/api/task/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId })
        }).catch(() => {});
      });
    }, 15000);

    // Cleanup on Tab Close (sendBeacon)
    const handleUnload = () => {
      activeTaskIdsRef.current.forEach(taskId => {
        navigator.sendBeacon(
          'http://localhost:8081/api/task/cancel',
          JSON.stringify({ task_id: taskId })
        );
      });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const updateTask = useCallback((id: string, data: Partial<Task>) => {
    setTasks(prev => ({
      ...prev,
      [id]: { ...prev[id], ...data }
    }));
  }, []);

  const startTask = useCallback((id: string, runFn: (update: (data: Partial<Task>) => void) => Promise<void>) => {
    if (taskStatusRef.current[id]) return;

    taskStatusRef.current[id] = true;
    
    setTasks(prev => ({
      ...prev,
      [id]: { id, status: 'running', progress: 'Đang bắt đầu...', results: [], metadata: {} }
    }));

    runFn((data) => updateTask(id, data))
      .then(() => {
        updateTask(id, { status: 'completed', progress: 'Hoàn thành' });
      })
      .catch((err) => {
        updateTask(id, { status: 'error', progress: `Lỗi: ${err.message}` });
      })
      .finally(() => {
        taskStatusRef.current[id] = false;
      });
  }, [updateTask]);

  const getTask = useCallback((id: string) => tasksRef.current[id], []);

  return (
    <TaskContext.Provider value={{ tasks, startTask, getTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
}
