import { useState } from 'react';
import type { MentorshipLog } from '../types/lms';
import { initialMentorshipLogs } from '../data/seed';

export function useMentorshipLogs() {
  const [mentorshipLogs, setMentorshipLogs] = useState<MentorshipLog[]>(initialMentorshipLogs);

  function addMentorshipLog(logData: Partial<MentorshipLog>, currentUserId: number): void {
    const newLog: MentorshipLog = {
      id: Math.max(...mentorshipLogs.map(l => l.id), 0) + 1,
      mentorId: logData.mentorId || currentUserId,
      studentId: logData.studentId || 0,
      type: logData.type || 'digital',
      date: logData.date || new Date().toISOString().split('T')[0],
      notes: logData.notes || '',
      duration: logData.duration,
      topics: logData.topics || [],
      nextSteps: logData.nextSteps,
      studentProgress: logData.studentProgress
    };
    setMentorshipLogs([...mentorshipLogs, newLog]);
  }

  function updateMentorshipLog(id: number, updates: Partial<MentorshipLog>): void {
    setMentorshipLogs(mentorshipLogs.map(log =>
      log.id === id ? { ...log, ...updates } : log
    ));
  }

  return { mentorshipLogs, setMentorshipLogs, addMentorshipLog, updateMentorshipLog };
}
