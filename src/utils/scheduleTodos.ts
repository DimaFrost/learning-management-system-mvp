import type {
  DutyScheduleEntry,
  PrayerScheduleEntry,
  TodoItem,
  User,
} from '../types/lms';
import { getTodayDateString } from './courseUtils';
import {
  getTuesdayDateForWeek,
  getThursdayDateForWeek,
} from './attendanceUtils';
import { formatPlatformDate } from './dateUtils';

const SCHEDULE_HORIZON_DAYS = 30;

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function scheduleTodoId(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
  }
  return -Math.abs(hash) || -1;
}

function buildBaseScheduleTodo(
  user: User,
  idSeed: string,
  title: string,
  description: string,
  dueDate: string,
  priority: TodoItem['priority'] = 'none'
): TodoItem {
  const now = new Date().toISOString();
  return {
    id: scheduleTodoId(idSeed),
    batchId: null,
    title,
    description,
    assignedTo: user.id,
    assignedToName: user.name,
    assignedToAvatarUrl: user.avatarUrl ?? null,
    createdBy: user.id,
    createdByName: 'Schedule',
    dueDate,
    priority,
    status: 'open',
    assignmentType: 'person',
    targetLabel: null,
    recipientCount: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    readOnly: true,
  };
}

export function buildScheduleTodosForStudent(
  user: User,
  dutySchedule: DutyScheduleEntry[],
  prayerSchedule: PrayerScheduleEntry[],
  today: string = getTodayDateString(),
  horizonDays: number = SCHEDULE_HORIZON_DAYS
): TodoItem[] {
  const horizon = addDaysToDateKey(today, horizonDays);
  const todos: TodoItem[] = [];

  for (const duty of dutySchedule) {
    if (duty.studentId !== user.id || duty.status !== 'active') continue;
    if (duty.weekEnd < today) continue;
    if (duty.weekStart > horizon) continue;

    const isCurrentWeek = duty.weekStart <= today && duty.weekEnd >= today;
    todos.push(
      buildBaseScheduleTodo(
        user,
        `duty:${duty.id}:${duty.weekStart}`,
        'You are on duty',
        `Mark class attendance for the week of ${formatPlatformDate(duty.weekStart)} – ${formatPlatformDate(duty.weekEnd)}.`,
        duty.weekEnd,
        isCurrentWeek ? 'priority' : 'none'
      )
    );
  }

  for (const entry of prayerSchedule) {
    if (entry.tuesdayStudentId === user.id) {
      const eventDate = getTuesdayDateForWeek(entry.weekStart);
      if (eventDate >= today && eventDate <= horizon) {
        const isThisWeek = eventDate <= addDaysToDateKey(today, 7);
        todos.push(
          buildBaseScheduleTodo(
            user,
            `prayer-tuesday:${entry.id}:${entry.weekStart}`,
            'Lead Tuesday prayer',
            `You are scheduled to lead prayer on ${formatPlatformDate(eventDate)}.`,
            eventDate,
            isThisWeek ? 'priority' : 'none'
          )
        );
      }
    }

    if (entry.thursdayStudentId === user.id) {
      const eventDate = getThursdayDateForWeek(entry.weekStart);
      if (eventDate >= today && eventDate <= horizon) {
        const isThisWeek = eventDate <= addDaysToDateKey(today, 7);
        todos.push(
          buildBaseScheduleTodo(
            user,
            `prayer-thursday:${entry.id}:${entry.weekStart}`,
            'Lead Thursday prayer',
            `You are scheduled to lead prayer on ${formatPlatformDate(eventDate)}.`,
            eventDate,
            isThisWeek ? 'priority' : 'none'
          )
        );
      }
    }
  }

  return todos.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
