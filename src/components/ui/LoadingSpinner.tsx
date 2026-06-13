interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"
        role="status"
        aria-label={message}
      />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
