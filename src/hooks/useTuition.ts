import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { queueWorkflowEmail } from '../utils/notificationJobs';
import type {
  Course,
  CourseStudent,
  StudentTuitionAccount,
  StudentTuitionPayment,
  TuitionAccountStatus,
  TuitionInstallment,
  TuitionPlan,
  TuitionReminderLog,
  User,
} from '../types/lms';

type PlanRow = {
  id: number;
  name: string;
  course_id: number | null;
  academic_year: string | null;
  currency: string;
  total_amount: number | string;
  status: TuitionPlan['status'];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InstallmentRow = {
  id: number;
  plan_id: number;
  title: string;
  amount: number | string;
  due_date: string;
  reminder_days_before: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AccountRow = {
  id: number;
  student_id: string;
  plan_id: number;
  expected_amount: number | string;
  discount_amount: number | string;
  status: TuitionAccountStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: number;
  account_id: number;
  student_id: string;
  amount: number | string;
  payment_date: string;
  method: string;
  reference: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

type ReminderRow = {
  id: number;
  account_id: number | null;
  installment_id: number | null;
  student_id: string;
  sent_by: string | null;
  subject: string;
  body: string;
  status: TuitionReminderLog['status'];
  notification_job_id: number | null;
  sent_at: string | null;
  created_at: string;
};

export type TuitionSummary = {
  expected: number;
  collected: number;
  remaining: number;
  overdueStudents: number;
  unpaidStudents: number;
  nextInstallment: TuitionInstallment | null;
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapPlan(row: PlanRow): TuitionPlan {
  return {
    id: row.id,
    name: row.name,
    courseId: row.course_id,
    academicYear: row.academic_year,
    currency: row.currency,
    totalAmount: toNumber(row.total_amount),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInstallment(row: InstallmentRow): TuitionInstallment {
  return {
    id: row.id,
    planId: row.plan_id,
    title: row.title,
    amount: toNumber(row.amount),
    dueDate: row.due_date,
    reminderDaysBefore: row.reminder_days_before,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccount(row: AccountRow): StudentTuitionAccount {
  return {
    id: row.id,
    studentId: row.student_id,
    planId: row.plan_id,
    expectedAmount: toNumber(row.expected_amount),
    discountAmount: toNumber(row.discount_amount),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: PaymentRow): StudentTuitionPayment {
  return {
    id: row.id,
    accountId: row.account_id,
    studentId: row.student_id,
    amount: toNumber(row.amount),
    paymentDate: row.payment_date,
    method: row.method,
    reference: row.reference,
    note: row.note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

function mapReminder(row: ReminderRow): TuitionReminderLog {
  return {
    id: row.id,
    accountId: row.account_id,
    installmentId: row.installment_id,
    studentId: row.student_id,
    sentBy: row.sent_by,
    subject: row.subject,
    body: row.body,
    status: row.status,
    notificationJobId: row.notification_job_id,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function isMissingTuitionTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return error.code === '42P01' || message.includes('tuition_') || message.includes('student_tuition_');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function deriveStatus(expected: number, paid: number, dueDate?: string | null): TuitionAccountStatus {
  if (expected <= 0) return 'open';
  if (paid >= expected) return 'paid';
  if (paid > 0) return 'part_paid';
  if (dueDate && dueDate < todayKey()) return 'overdue';
  return 'open';
}

export function useTuition(currentUser: User, users: User[], courseStudents: CourseStudent[], courses: Course[]) {
  const [plans, setPlans] = useState<TuitionPlan[]>([]);
  const [installments, setInstallments] = useState<TuitionInstallment[]>([]);
  const [accounts, setAccounts] = useState<StudentTuitionAccount[]>([]);
  const [payments, setPayments] = useState<StudentTuitionPayment[]>([]);
  const [reminders, setReminders] = useState<TuitionReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = currentUser.roles.includes('administrator');

  const refetch = useCallback(async () => {
    if (!isAdmin) {
      setPlans([]);
      setInstallments([]);
      setAccounts([]);
      setPayments([]);
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const [plansResult, installmentsResult, accountsResult, paymentsResult, remindersResult] = await Promise.all([
      supabase.from('tuition_plans').select('*').order('created_at', { ascending: false }),
      supabase.from('tuition_installments').select('*').order('due_date', { ascending: true }),
      supabase.from('student_tuition_accounts').select('*').order('updated_at', { ascending: false }),
      supabase.from('student_tuition_payments').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('tuition_reminder_logs').select('*').order('created_at', { ascending: false }),
    ]);

    const fetchError = plansResult.error || installmentsResult.error || accountsResult.error || paymentsResult.error || remindersResult.error;
    if (fetchError) {
      if (isMissingTuitionTable(fetchError)) {
        setPlans([]);
        setInstallments([]);
        setAccounts([]);
        setPayments([]);
        setReminders([]);
        setLoading(false);
        return;
      }
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setPlans(((plansResult.data ?? []) as PlanRow[]).map(mapPlan));
    setInstallments(((installmentsResult.data ?? []) as InstallmentRow[]).map(mapInstallment));
    setAccounts(((accountsResult.data ?? []) as AccountRow[]).map(mapAccount));
    setPayments(((paymentsResult.data ?? []) as PaymentRow[]).map(mapPayment));
    setReminders(((remindersResult.data ?? []) as ReminderRow[]).map(mapReminder));
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const paymentTotalsByAccount = useMemo(() => {
    const totals = new Map<number, number>();
    payments.forEach(payment => {
      totals.set(payment.accountId, (totals.get(payment.accountId) ?? 0) + payment.amount);
    });
    return totals;
  }, [payments]);

  const summary = useMemo<TuitionSummary>(() => {
    const expected = accounts.reduce((total, account) => total + Math.max(0, account.expectedAmount - account.discountAmount), 0);
    const collected = payments.reduce((total, payment) => total + payment.amount, 0);
    const activeInstallments = installments
      .filter(installment => plans.some(plan => plan.id === installment.planId && plan.status === 'active'))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextInstallment = activeInstallments.find(installment => installment.dueDate >= todayKey()) ?? activeInstallments[activeInstallments.length - 1] ?? null;
    const overdueStudents = accounts.filter(account => {
      const paid = paymentTotalsByAccount.get(account.id) ?? 0;
      const planInstallments = installments.filter(installment => installment.planId === account.planId);
      const pastDue = planInstallments.some(installment => installment.dueDate < todayKey());
      return pastDue && paid < Math.max(0, account.expectedAmount - account.discountAmount);
    }).length;
    const unpaidStudents = accounts.filter(account => (paymentTotalsByAccount.get(account.id) ?? 0) <= 0).length;
    return {
      expected,
      collected,
      remaining: Math.max(0, expected - collected),
      overdueStudents,
      unpaidStudents,
      nextInstallment,
    };
  }, [accounts, installments, paymentTotalsByAccount, payments, plans]);

  const createPlan = useCallback(async (input: {
    name: string;
    courseId?: number | null;
    academicYear?: string | null;
    currency: string;
    totalAmount: number;
    firstDueDate?: string;
    secondDueDate?: string;
  }) => {
    const { data, error: insertError } = await supabase.from('tuition_plans').insert({
      name: input.name.trim(),
      course_id: input.courseId ?? null,
      academic_year: input.academicYear?.trim() || null,
      currency: input.currency || 'EUR',
      total_amount: input.totalAmount,
      status: 'active',
      created_by: currentUser.id,
    }).select('*').single();
    if (insertError) throw insertError;
    const plan = mapPlan(data as PlanRow);
    const installmentRows = [
      input.firstDueDate ? { plan_id: plan.id, title: 'First installment', amount: input.totalAmount / 2, due_date: input.firstDueDate, reminder_days_before: 7, sort_order: 1 } : null,
      input.secondDueDate ? { plan_id: plan.id, title: 'Second installment', amount: input.totalAmount / 2, due_date: input.secondDueDate, reminder_days_before: 7, sort_order: 2 } : null,
    ].filter(Boolean);
    if (installmentRows.length > 0) {
      const { error: installmentError } = await supabase.from('tuition_installments').insert(installmentRows);
      if (installmentError) throw installmentError;
    }
    await refetch();
    return plan;
  }, [currentUser.id, refetch]);

  const upsertInstallment = useCallback(async (input: Partial<TuitionInstallment> & { planId: number; title: string; amount: number; dueDate: string }) => {
    const row = {
      ...(input.id ? { id: input.id } : {}),
      plan_id: input.planId,
      title: input.title.trim(),
      amount: input.amount,
      due_date: input.dueDate,
      reminder_days_before: input.reminderDaysBefore ?? 7,
      sort_order: input.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    };
    const { error: upsertError } = await supabase.from('tuition_installments').upsert(row);
    if (upsertError) throw upsertError;
    await refetch();
  }, [refetch]);

  const enrollStudent = useCallback(async (input: { studentId: string; planId: number; expectedAmount?: number; discountAmount?: number; notes?: string }) => {
    const plan = plans.find(item => item.id === input.planId);
    const { error: upsertError } = await supabase.from('student_tuition_accounts').upsert({
      student_id: input.studentId,
      plan_id: input.planId,
      expected_amount: input.expectedAmount ?? plan?.totalAmount ?? 0,
      discount_amount: input.discountAmount ?? 0,
      status: 'open',
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,plan_id' });
    if (upsertError) throw upsertError;
    await refetch();
  }, [plans, refetch]);

  const recordPayment = useCallback(async (input: { accountId: number; amount: number; paymentDate: string; method: string; reference?: string; note?: string }) => {
    const account = accounts.find(item => item.id === input.accountId);
    if (!account) throw new Error('Tuition account not found.');
    const { error: insertError } = await supabase.from('student_tuition_payments').insert({
      account_id: input.accountId,
      student_id: account.studentId,
      amount: input.amount,
      payment_date: input.paymentDate,
      method: input.method,
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      recorded_by: currentUser.id,
    });
    if (insertError) throw insertError;
    const paid = (paymentTotalsByAccount.get(account.id) ?? 0) + input.amount;
    const nextDue = installments.filter(item => item.planId === account.planId).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate ?? null;
    await supabase.from('student_tuition_accounts').update({
      status: deriveStatus(Math.max(0, account.expectedAmount - account.discountAmount), paid, nextDue),
      updated_at: new Date().toISOString(),
    }).eq('id', account.id);
    await refetch();
  }, [accounts, currentUser.id, installments, paymentTotalsByAccount, refetch]);

  const sendReminder = useCallback(async (accountIds: number[], installmentId?: number | null) => {
    const targets = accounts.filter(account => accountIds.includes(account.id));
    const installment = installmentId ? installments.find(item => item.id === installmentId) ?? null : null;
    const logs: Omit<ReminderRow, 'id' | 'created_at' | 'sent_at' | 'notification_job_id'>[] = [];
    await Promise.all(targets.map(async account => {
      const student = users.find(user => user.id === account.studentId);
      if (!student) return;
      const paid = paymentTotalsByAccount.get(account.id) ?? 0;
      const expected = Math.max(0, account.expectedAmount - account.discountAmount);
      const remaining = Math.max(0, expected - paid);
      if (remaining <= 0) return;
      const subject = 'Tuition payment reminder';
      const body = `This is a tuition reminder for ${student.name}.\n\nRemaining amount: ${remaining.toFixed(2)} ${plans.find(plan => plan.id === account.planId)?.currency ?? 'EUR'}${installment ? `\nInstallment: ${installment.title}\nDue: ${installment.dueDate}` : ''}`;
      const jobId = await queueWorkflowEmail({
        createdBy: currentUser.id,
        recipientIds: [student.id],
        subject,
        title: 'Tuition reminder',
        body,
        kind: 'system',
      });
      logs.push({
        account_id: account.id,
        installment_id: installment?.id ?? null,
        student_id: student.id,
        sent_by: currentUser.id,
        subject,
        body,
        status: 'queued',
        notification_job_id: jobId,
      });
    }));
    if (logs.length > 0) {
      const { error: insertError } = await supabase.from('tuition_reminder_logs').insert(logs);
      if (insertError) throw insertError;
    }
    await refetch();
  }, [accounts, currentUser.id, installments, paymentTotalsByAccount, plans, refetch, users]);

  const activeStudents = useMemo(() => {
    const activeCourseIds = new Set(courses.filter(course => course.status === 'active').map(course => course.id));
    const studentIds = new Set(courseStudents.filter(enrollment => enrollment.status === 'active' && activeCourseIds.has(enrollment.courseId)).map(enrollment => enrollment.studentId));
    return users.filter(user => user.roles.includes('student') && studentIds.has(user.id));
  }, [courseStudents, courses, users]);

  const activeStudentsByCourseType = useMemo(() => {
    const activeCoursesById = new Map(courses.filter(course => course.status === 'active').map(course => [course.id, course]));
    const idsByType = {
      first_year: new Set<string>(),
      second_year: new Set<string>(),
    };
    courseStudents.forEach(enrollment => {
      if (enrollment.status !== 'active') return;
      const course = activeCoursesById.get(enrollment.courseId);
      if (!course) return;
      idsByType[course.courseType].add(enrollment.studentId);
    });
    return {
      firstYear: users.filter(user => user.roles.includes('student') && idsByType.first_year.has(user.id)),
      secondYear: users.filter(user => user.roles.includes('student') && idsByType.second_year.has(user.id)),
    };
  }, [courseStudents, courses, users]);

  return {
    plans,
    installments,
    accounts,
    payments,
    reminders,
    loading,
    error,
    summary,
    activeStudents,
    activeStudentsByCourseType,
    paymentTotalsByAccount,
    refetch,
    createPlan,
    upsertInstallment,
    enrollStudent,
    recordPayment,
    sendReminder,
  };
}
