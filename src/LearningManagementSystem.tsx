import React from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/AuthScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { AuthenticatedApp } from './AuthenticatedApp';

const LearningManagementSystem = () => {
  const { currentUser, loading: authLoading, error, signInWithGoogle, signOut, refetchProfile } = useAuth();

  if (authLoading && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
