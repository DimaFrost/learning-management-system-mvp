import { useState, useEffect, useRef } from 'react';
import { X, Mail, Copy } from 'lucide-react';
import type { User } from '../../types/lms';

interface ContactMentorModalProps {
  mentor: User | null;
  onClose: () => void;
}

export function ContactMentorModal({ mentor, onClose }: ContactMentorModalProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCopied(false);
  }, [mentor]);

  if (!mentor) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(mentor.email);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts; no-op
    }
  };

  const handleSendEmail = () => {
    window.open('mailto:' + mentor.email);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{mentor.name}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-900 break-all">{mentor.email}</span>
                <button
                  onClick={handleCopyEmail}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
              <div className="flex flex-wrap gap-1">
                {mentor.roles.map(role => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleSendEmail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Mail className="w-4 h-4" />
              Send Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
