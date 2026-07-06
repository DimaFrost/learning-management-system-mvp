interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="tbo-card max-w-lg px-4 py-3">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tbo-button-primary mt-3 px-4 py-2 text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
