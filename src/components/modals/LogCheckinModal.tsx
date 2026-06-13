import { useState, useEffect, type FormEvent } from 'react';
import type { User, EditingItem, MentorshipLog } from '../../types/lms';
import { X, Save } from 'lucide-react';

interface LogCheckinModalProps {
  editingItem: EditingItem | null;
  currentUser: User;
  onClose: () => void;
  onAddLog: (logData: Partial<MentorshipLog>, currentUserId: string) => void;
  onUpdateLog: (id: number, updates: Partial<MentorshipLog>) => void;
  getUserById: (id: string | null) => User | undefined;
}

export function LogCheckinModal({ editingItem, currentUser, onClose, onAddLog, onUpdateLog, getUserById }: LogCheckinModalProps) {
  const [logType, setLogType] = useState<'digital' | 'in_person'>('digital');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [nextSteps, setNextSteps] = useState('');
  const [studentProgress, setStudentProgress] = useState<'excellent' | 'good' | 'needs_improvement' | 'concern' | ''>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Check if we're editing an existing log
  const isEditing = editingItem?.type === 'log' && editingItem?.data;
  const existingLog = isEditing ? editingItem.data as MentorshipLog : null;

  const availableTopics = [
    'goal setting', 'progress review', 'challenges', 'study habits', 
    'course expectations', 'javascript basics', 'learning strategies',
    'time management', 'technical skills', 'career guidance'
  ];

  // Populate form when editing existing log
  useEffect(() => {
    if (existingLog) {
      setLogType(existingLog.type);
      setNotes(existingLog.notes);
      setDuration(existingLog.duration || '');
      setTopics(existingLog.topics || []);
      setNextSteps(existingLog.nextSteps || '');
      setStudentProgress(existingLog.studentProgress || '');
      setSelectedDate(new Date(existingLog.date));
    } else {
      // Reset form for new log
      setLogType('digital');
      setNotes('');
      setDuration('');
      setTopics([]);
      setNextSteps('');
      setStudentProgress('');
      setSelectedDate(new Date());
    }
  }, [existingLog]);

  const handleTopicToggle = (topic: string) => {
    setTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: {[key: string]: string} = {};

    // Validation
    if (!notes.trim()) {
      newErrors.notes = 'Notes are required';
    }
    if (!studentProgress) {
      newErrors.studentProgress = 'Student progress assessment is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const logData = {
      type: logType,
      date: selectedDate.toISOString().split('T')[0],
      notes: notes.trim(),
      duration: duration ? Number(duration) : undefined,
      topics: topics.length > 0 ? topics : undefined,
      nextSteps: nextSteps.trim() || undefined,
      studentProgress: studentProgress as any
    };

    if (isEditing && existingLog) {
      // Update existing log
      onUpdateLog(existingLog.id, logData);
    } else {
      // Create new log
      onAddLog({
        ...logData,
        mentorId: currentUser.id,
        studentId: editingItem?.studentId!
      }, currentUser.id);
    }

    onClose();
    setNotes('');
    setDuration('');
    setTopics([]);
    setNextSteps('');
    setStudentProgress('');
    setSelectedDate(new Date());
    setErrors({});
  };

  if (!editingItem || editingItem.type !== 'log') return null;

  const student = editingItem.studentId ? getUserById(editingItem.studentId) : undefined;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit Check-in' : 'Log Check-in'} with {student?.name}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Type</label>
              <select 
                value={logType} 
                onChange={(e) => setLogType(e.target.value as 'digital' | 'in_person')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="digital">💻 Digital Check-in</option>
                <option value="in_person">🤝 In-person Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 30"
                min="1"
                max="300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discussion Topics</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableTopics.map(topic => (
                <label key={topic} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={topics.includes(topic)}
                    onChange={() => handleTopicToggle(topic)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 capitalize">{topic}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Progress</label>
            <select 
              value={studentProgress} 
              onChange={(e) => setStudentProgress(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select progress level</option>
              <option value="excellent">🌟 Excellent - Exceeding expectations</option>
              <option value="good">👍 Good - Meeting expectations</option>
              <option value="needs_improvement">⚠️ Needs Improvement - Below expectations</option>
              <option value="concern">🚨 Concern - Significant issues</option>
            </select>
            {errors.studentProgress && <p className="text-red-500 text-sm mt-1">{errors.studentProgress}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add detailed notes about this check-in..."
              required
            />
            {errors.notes && <p className="text-red-500 text-sm mt-1">{errors.notes}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Next Steps</label>
            <textarea 
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What should the student focus on next?"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Update Check-in' : 'Save Check-in'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
