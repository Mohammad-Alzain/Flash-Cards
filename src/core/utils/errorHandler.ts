export interface AppErrorDetails {
  title: string;
  message: string;
  context?: string;
  stack?: string;
  timestamp?: number;
}

type ErrorListener = (error: AppErrorDetails) => void;
const listeners = new Set<ErrorListener>();

export function reportError(context: string, error: any, customTitle?: string): AppErrorDetails {
  const message = error?.message || String(error) || 'An unexpected error occurred';
  const stack = error?.stack || (error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : '');
  const title = customTitle || (context ? `Error in ${context}` : 'Error');

  const errorObj: AppErrorDetails = {
    title,
    message,
    context,
    stack,
    timestamp: Date.now(),
  };

  console.error(`[AppError][${context}]`, message, error);

  // Notify any active global modal listeners
  listeners.forEach((listener) => {
    try {
      listener(errorObj);
    } catch (e) {
      console.warn('[reportError] Listener error:', e);
    }
  });

  return errorObj;
}

export function subscribeToErrors(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
