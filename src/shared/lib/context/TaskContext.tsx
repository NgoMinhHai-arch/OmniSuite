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
    const postTaskSignal = (path: '/api/interpreter/heartbeat' | '/api/interpreter/cancel', taskId: string) => {
      const url = path;
      const payload = JSON.stringify({ task_id: taskId });

      // sendBeacon is best-effort on tab close; use JSON blob so Flask request.get_json() works.
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        const queued = navigator.sendBeacon(url, blob);
        if (queued) return;
      }

      // Fallback path for normal lifecycle events (not guaranteed during unload).
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    // Heartbeat every 15 seconds
    const interval = setInterval(() => {
      activeTaskIdsRef.current.forEach(taskId => {
        postTaskSignal('/api/interpreter/heartbeat', taskId);
      });
    }, 15000);

    // Cleanup as soon as tab/page is being closed or backgrounded.
    const cancelAllActiveTasks = () => {
      activeTaskIdsRef.current.forEach(taskId => {
        postTaskSignal('/api/interpreter/cancel', taskId);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cancelAllActiveTasks();
      }
    };

    window.addEventListener('beforeunload', cancelAllActiveTasks);
    window.addEventListener('pagehide', cancelAllActiveTasks);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', cancelAllActiveTasks);
      window.removeEventListener('pagehide', cancelAllActiveTasks);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
