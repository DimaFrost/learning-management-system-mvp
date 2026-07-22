import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { queueWorkflowEmail } from '../utils/notificationJobs';
import type {
  Course,
  CourseStudent,
  TodoAssignmentCategory,
  TodoAssignmentType,
  TodoItem,
  TodoPriority,
  TodoStatus,
  User,
} from '../types/lms';

type TodoProfileJoin = {
  id: string;
  name: string | null;
  avatar_url?: string | null;
} | null;

type TodoRow = {
  id: number;
  batch_id?: number | null;
  title: string;
  description: string | null;
  assigned_to: string;
  created_by: string;
  due_date: string;
  priority: TodoPriority;
  status: TodoStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned?: TodoProfileJoin;
  creator?: TodoProfileJoin;
  batch?: {
    id: number;
    assignment_type: TodoAssignmentType;
    target_label: string;
    recipient_count: number;
  } | null;
};

type CreateTodoInput = {
  title: string;
  description?: string | null;
  assignedTo?: string;
  assignedToIds?: string[];
  assignmentType?: TodoAssignmentType;
  targetLabel?: string;
  targetIds?: string[];
  dueDate: string;
  priority: TodoPriority;
};

type UpdateTodoInput = Partial<{
  title: string;
  description: string | null;
  assignedTo: string;
  dueDate: string;
  priority: TodoPriority;
  status: TodoStatus;
}>;

const STAFF_ROLES = new Set(['administrator', 'teacher', 'translator', 'mentor']);

function getRealRoles(user: User) {
  return user.roles.filter(role => role !== 'dev');
}

function isStaffUser(user: User) {
  const realRoles = getRealRoles(user);
  return realRoles.length > 0 && !realRoles.every(role => role === 'student');
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function mapTodoRow(row: TodoRow): TodoItem {
  return {
    id: row.id,
    batchId: row.batch_id ?? row.batch?.id ?? null,
    title: row.title,
    description: row.description,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned?.name ?? null,
    assignedToAvatarUrl: row.assigned?.avatar_url ?? null,
    createdBy: row.created_by,
    createdByName: row.creator?.name ?? null,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    assignmentType: row.batch?.assignment_type ?? 'person',
    targetLabel: row.batch?.target_label ?? null,
    recipientCount: row.batch?.recipient_count ?? null,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01' || error.message?.toLowerCase().includes('todo_items') === true;
}

function isMissingBatchRelationError(error: { message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return message.includes('todo_batches') || message.includes('batch_id') || message.includes('relationship');
}

function getReminderTimeIso(dueDate: string, offsetDays: number) {
  const reminderDate = new Date(`${dueDate}T09:00:00`);
  reminderDate.setDate(reminderDate.getDate() + offsetDays);
  const now = new Date();
  if (reminderDate < now) return now.toISOString();
  return reminderDate.toISOString();
}

function getTodayKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useTodos(
  currentUser: User,
  users: User[],
  enrollments: CourseStudent[] = [],
  courses: Course[] = []
) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = currentUser.roles.includes('administrator');
  const canUseTodos = currentUser.roles.some(role => STAFF_ROLES.has(role) || role === 'student');
  const canCreateTodos = currentUser.roles.some(role => STAFF_ROLES.has(role));

  const refetchTodos = useCallback(async () => {
    if (!canUseTodos) {
      setTodos([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const todoSelect = `
      *,
      assigned:profiles!todo_items_assigned_to_fkey(id, name, avatar_url),
      creator:profiles!todo_items_created_by_fkey(id, name),
      batch:todo_batches!todo_items_batch_id_fkey(id, assignment_type, target_label, recipient_count)
    `;
    const fallbackTodoSelect = `
      *,
      assigned:profiles!todo_items_assigned_to_fkey(id, name, avatar_url),
      creator:profiles!todo_items_created_by_fkey(id, name)
    `;

    let { data, error: fetchError } = await supabase
      .from('todo_items')
      .select(todoSelect)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (fetchError && isMissingBatchRelationError(fetchError)) {
      const fallback = await supabase
        .from('todo_items')
        .select(fallbackTodoSelect)
        .order('due_date', { ascending: true })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      data = fallback.data;
      fetchError = fallback.error;
    }

    if (fetchError) {
      if (isMissingTableError(fetchError)) {
        setTodos([]);
        setLoading(false);
        return;
      }
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setTodos(((data ?? []) as TodoRow[]).map(mapTodoRow));
    setLoading(false);
  }, [canUseTodos]);

  useEffect(() => {
    void refetchTodos();
  }, [refetchTodos]);

  const cancelTodoReminderJobs = useCallback(async (todoId: number) => {
    await supabase
      .from('notification_jobs')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('type', 'todo_reminder_email')
      .contains('payload', { todoId })
      .in('status', ['pending', 'failed']);
  }, []);

  const syncTodoReminderJobs = useCallback(async (todo: TodoItem) => {
    await cancelTodoReminderJobs(todo.id);

    if (todo.priority !== 'priority' || todo.status === 'completed') return;

    const jobs = [
      {
        type: 'todo_reminder_email',
        status: 'pending',
        scheduled_for: getReminderTimeIso(todo.dueDate, -1),
        created_by: currentUser.id,
        payload: {
          todoId: todo.id,
          reminderKind: 'day_before',
        },
        attempts: 0,
        processed_at: null,
        error_message: null,
      },
      {
        type: 'todo_reminder_email',
        status: 'pending',
        scheduled_for: getReminderTimeIso(todo.dueDate, 0),
        created_by: currentUser.id,
        payload: {
          todoId: todo.id,
          reminderKind: 'due_day',
        },
        attempts: 0,
        processed_at: null,
        error_message: null,
      },
    ];

    await supabase.from('notification_jobs').insert(jobs);
  }, [cancelTodoReminderJobs, currentUser.id]);

  const createTodo = useCallback(async (input: CreateTodoInput) => {
    const assignedToIds = isAdmin && input.assignedToIds?.length
      ? uniqueIds(input.assignedToIds)
      : [isAdmin ? input.assignedTo || currentUser.id : currentUser.id];
    const assignmentType = isAdmin && input.assignmentType === 'category' ? 'category' : 'person';
    const targetIds = input.targetIds?.length
      ? input.targetIds
      : assignmentType === 'category'
        ? assignedToIds
        : [assignedToIds[0]];
    const targetLabel = input.targetLabel?.trim()
      || (assignmentType === 'category'
        ? `${assignedToIds.length} recipients`
        : users.find(user => user.id === assignedToIds[0])?.name || currentUser.name);

    let batchId: number | null = null;
    const { data: batch, error: batchError } = await supabase
      .from('todo_batches')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        created_by: currentUser.id,
        due_date: input.dueDate,
        priority: input.priority,
        assignment_type: assignmentType,
        target_label: targetLabel,
        target_ids: targetIds,
        recipient_count: assignedToIds.length,
      })
      .select('id')
      .single();

    if (batchError && !isMissingBatchRelationError(batchError)) {
      throw batchError;
    }
    batchId = batch?.id ?? null;

    const rows = assignedToIds.map(assignedTo => ({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: assignedTo,
      created_by: currentUser.id,
      ...(batchId ? { batch_id: batchId } : {}),
      due_date: input.dueDate,
      priority: input.priority,
      status: 'open',
    }));

    let { data, error: insertError } = await supabase
      .from('todo_items')
      .insert(rows)
      .select(`
        *,
        assigned:profiles!todo_items_assigned_to_fkey(id, name, avatar_url),
        creator:profiles!todo_items_created_by_fkey(id, name),
        batch:todo_batches!todo_items_batch_id_fkey(id, assignment_type, target_label, recipient_count)
      `);

    if (insertError && isMissingBatchRelationError(insertError)) {
      const fallbackRows = rows.map(({ batch_id: _batchId, ...row }) => row);
      const fallback = await supabase
        .from('todo_items')
        .insert(fallbackRows)
        .select(`
          *,
          assigned:profiles!todo_items_assigned_to_fkey(id, name, avatar_url),
          creator:profiles!todo_items_created_by_fkey(id, name)
        `);
      data = fallback.data;
      insertError = fallback.error;
    }

    if (insertError) throw insertError;

    const createdTodos = ((data ?? []) as TodoRow[]).map(mapTodoRow);
    if (createdTodos.length === 0) {
      throw new Error('No to-dos were created.');
    }
    await Promise.all(createdTodos.map(syncTodoReminderJobs));
    void queueWorkflowEmail({
      createdBy: currentUser.id,
      recipientIds: createdTodos.map(todo => todo.assignedTo),
      subject: `New to-do: ${input.title.trim()}`,
      title: `New to-do assigned by ${currentUser.name}`,
      body: `${input.title.trim()}\n\n${input.description?.trim() || ''}\n\nDue: ${input.dueDate}`.trim(),
      kind: 'system',
    });
    await refetchTodos();
    return createdTodos[0];
  }, [currentUser.id, currentUser.name, isAdmin, refetchTodos, syncTodoReminderJobs, users]);

  const updateTodo = useCallback(async (todoId: number, updates: UpdateTodoInput) => {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) row.title = updates.title.trim();
    if (updates.description !== undefined) row.description = updates.description?.trim() || null;
    if (updates.assignedTo !== undefined) row.assigned_to = isAdmin ? updates.assignedTo : currentUser.id;
    if (updates.dueDate !== undefined) row.due_date = updates.dueDate;
    if (updates.priority !== undefined) row.priority = updates.priority;
    if (updates.status !== undefined) {
      row.status = updates.status;
      row.completed_at = updates.status === 'completed' ? new Date().toISOString() : null;
    }

    const { data, error: updateError } = await supabase
      .from('todo_items')
      .update(row)
      .eq('id', todoId)
      .select(`
        *,
        assigned:profiles!todo_items_assigned_to_fkey(id, name, avatar_url),
        creator:profiles!todo_items_created_by_fkey(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    const updated = mapTodoRow(data as TodoRow);
    await syncTodoReminderJobs(updated);
    await refetchTodos();
    return updated;
  }, [currentUser.id, isAdmin, refetchTodos, syncTodoReminderJobs]);

  const toggleTodoStatus = useCallback(async (todoId: number, completed: boolean) => {
    return updateTodo(todoId, { status: completed ? 'completed' : 'open' });
  }, [updateTodo]);

  const deleteTodo = useCallback(async (todoId: number) => {
    await cancelTodoReminderJobs(todoId);
    const { error: deleteError } = await supabase
      .from('todo_items')
      .delete()
      .eq('id', todoId);
    if (deleteError) throw deleteError;
    await refetchTodos();
  }, [cancelTodoReminderJobs, refetchTodos]);

  const todayKey = getTodayKey();
  const todosToday = useMemo(
    () => todos.filter(todo => todo.status === 'open' && todo.dueDate <= todayKey),
    [todos, todayKey]
  );
  const openCount = useMemo(
    () => todos.filter(todo => todo.status === 'open').length,
    [todos]
  );
  const priorityCount = useMemo(
    () => todos.filter(todo => todo.status === 'open' && todo.priority === 'priority').length,
    [todos]
  );

  const assignableUsers = useMemo(
    () => isAdmin ? users : users.filter(user => user.id === currentUser.id),
    [currentUser.id, isAdmin, users]
  );
  const assignmentCategories = useMemo<TodoAssignmentCategory[]>(() => {
    const activeCourses = courses.filter(course => course.status === 'active');
    const activeFirstYearCourseIds = new Set(
      activeCourses.filter(course => course.courseType === 'first_year').map(course => course.id)
    );
    const activeSecondYearCourseIds = new Set(
      activeCourses.filter(course => course.courseType === 'second_year').map(course => course.id)
    );
    const activeEnrollments = enrollments.filter(enrollment => enrollment.status === 'active');
    const firstYearStudentIds = uniqueIds(
      activeEnrollments
        .filter(enrollment => activeFirstYearCourseIds.has(enrollment.courseId))
        .map(enrollment => enrollment.studentId)
    );
    const secondYearStudentIds = uniqueIds(
      activeEnrollments
        .filter(enrollment => activeSecondYearCourseIds.has(enrollment.courseId))
        .map(enrollment => enrollment.studentId)
    );

    return [
      {
        id: 'course:first_year',
        label: 'First Year Students',
        description: 'Active first year enrollments',
        userIds: firstYearStudentIds,
        tone: 'blue',
      },
      {
        id: 'course:second_year',
        label: 'Second Year Students',
        description: 'Active second year enrollments',
        userIds: secondYearStudentIds,
        tone: 'violet',
      },
      {
        id: 'role:teacher',
        label: 'Teachers',
        description: 'Users with the teacher role',
        userIds: users.filter(user => user.roles.includes('teacher')).map(user => user.id),
        tone: 'green',
      },
      {
        id: 'role:translator',
        label: 'Translators',
        description: 'Users with the translator role',
        userIds: users.filter(user => user.roles.includes('translator')).map(user => user.id),
        tone: 'orange',
      },
      {
        id: 'role:mentor',
        label: 'Mentors',
        description: 'Users with the mentor role',
        userIds: users.filter(user => user.roles.includes('mentor')).map(user => user.id),
        tone: 'gray',
      },
      {
        id: 'audience:staff',
        label: 'All Staff',
        description: 'Admins, teachers, translators, and mentors',
        userIds: users.filter(isStaffUser).map(user => user.id),
        tone: 'gray',
      },
    ].map(category => ({
      ...category,
      userIds: uniqueIds(category.userIds),
    }));
  }, [courses, enrollments, users]);

  return {
    todos,
    todosToday,
    openCount,
    priorityCount,
    assignableUsers,
    assignmentCategories,
    loading,
    error,
    canUseTodos,
    canCreateTodos,
    isAdmin,
    refetchTodos,
    createTodo,
    updateTodo,
    toggleTodoStatus,
    deleteTodo,
  };
}
