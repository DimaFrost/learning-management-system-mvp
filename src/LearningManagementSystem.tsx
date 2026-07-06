import React from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/AuthScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { AuthenticatedApp } from './AuthenticatedApp';

const LearningManagementSystem = () => {
  const { currentUser, loading: authLoading, error, signInWithGoogle, signOut, refetchProfile } = useAuth();

  if (authLoading && !currentUser) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4">
        <div className="absolute inset-0 tbo-dot-grid opacity-60" aria-hidden="true" />
        <LoadingSpinner />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onSignIn={signInWithGoogle} error={error} />;
  }

  return (
    <AuthenticatedApp
      currentUser={currentUser}
      onSignOut={signOut}
      onRefetchProfile={refetchProfile}
    />
  );
};

export default LearningManagementSystem;
