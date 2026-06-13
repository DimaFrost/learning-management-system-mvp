import { useState } from 'react';

export function useConfirmation() {
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });

  function showConfirmation(
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) {
    setConfirmationDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm
    });
  }

  function closeConfirmation() {
    setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
  }

  return { confirmationDialog, showConfirmation, closeConfirmation };
}
