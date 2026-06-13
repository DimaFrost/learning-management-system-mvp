import { GraduationCap, LogIn } from 'lucide-react';

interface AuthScreenProps {
  onSignIn: () => void;
  error: string | null;
}

export function AuthScreen({ onSignIn, error }: AuthScreenProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center space-x-3 mb-6">
          <GraduationCap className="w-10 h-10 text-amber-600" />
          <h1 className="text-2xl font-semibold text-gray-900">The Burning Ones</h1>
        </div>

        <p className="text-gray-600 mb-6">
          Sign in to access the learning management system.
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={onSignIn}
          className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors font-medium"
        >
          <LogIn className="w-4 h-4" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
