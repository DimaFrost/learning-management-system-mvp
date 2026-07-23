import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import type {
  Course,
  StudentTuitionAccount,
  StudentTuitionPayment,
  TuitionInstallment,
  TuitionPlan,
  TuitionReminderLog,
  User,
} from '../../types/lms';
import type { TuitionSummary } from '../../hooks/useTuition';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from './users/usersShared';

export type TuitionSection = 'overview' | 'students' | 'payments' | 'installments' | 'reminders' | 'settings';

type TuitionViewProps = {
  activeSection: TuitionSection;
  users: User[];
  courses: Course[];
  plans: TuitionPlan[];
  installments: TuitionInstallment[];
  accounts: StudentTuitionAccount[];
  payments: StudentTuitionPayment[];
  reminders: TuitionReminderLog[];
  activeStudents: User[];
  activeStudentsByCourseType: {
    firstYear: User[];
    secondYear: User[];
  };
  paymentTotalsByAccount: Map<number, number>;
  summary: TuitionSummary;
  loading: boolean;
  error: string | null;
  onCreatePlan: (input: {
    name: string;
    courseId?: number | null;
    academicYear?: string | null;
    currency: string;
    totalAmount: number;
    firstDueDate?: string;
    secondDueDate?: string;
  }) => Promise<unknown>;
  onUpsertInstallment: (input: Partial<TuitionInstallment> & { planId: number; title: string; amount: number; dueDate: string }) => Promise<void>;
  onEnrollStudent: (input: { studentId: string; planId: number; expectedAmount?: number; discountAmount?: number; notes?: string }) => Promise<void>;
  onRecordPayment: (input: { accountId: number; amount: number; paymentDate: string; method: string; reference?: string; note?: string }) => Promise<void>;
  onSendReminder: (accountIds: number[], installmentId?: number | null) => Promise<void>;
};

function currency(amount: number, code = 'EUR') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount || 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e5e5e5] bg-white ${className}`}>{children}</section>;
}

function StatCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  tone: 'green' | 'amber' | 'blue' | 'rose';
}) {
  const tones = {
    green: 'bg-[#f0fdf4] text-[#15803d] ring-[#bbf7d0]',
    amber: 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]',
    blue: 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]',
    rose: 'bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]',
  };
  return (
    <SectionCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#171717]">{value}</p>
          <p className="mt-1 text-xs text-[#737373]">{detail}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </SectionCard>
  );
}

export function TuitionView({
  activeSection,
  users,
  courses,
  plans,
  installments,
  accounts,
  payments,
  reminders,
  activeStudents,
  activeStudentsByCourseType,
  paymentTotalsByAccount,
  summary,
  loading,
  error,
  onCreatePlan,
  onUpsertInstallment,
  onEnrollStudent,
  onRecordPayment,
  onSendReminder,
}: TuitionViewProps) {
  const [search, setSearch] = useState('');
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [installmentFormOpen, setInstallmentFormOpen] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [confirmOutstandingOpen, setConfirmOutstandingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const defaultPlan = plans.find(plan => plan.status === 'active') ?? plans[0] ?? null;
  const activeCurrency = defaultPlan?.currency ?? 'EUR';

  const accountRows = useMemo(() => {
    return accounts.map(account => {
      const student = users.find(user => user.id === account.studentId) ?? null;
      const plan = plans.find(item => item.id === account.planId) ?? null;
      const paid = paymentTotalsByAccount.get(account.id) ?? 0;
      const expected = Math.max(0, account.expectedAmount - account.discountAmount);
      const remaining = Math.max(0, expected - paid);
      const planInstallments = installments.filter(item => item.planId === account.planId);
      const isOverdue = remaining > 0 && planInstallments.some(item => item.dueDate < todayKey());
      return { account, student, plan, paid, expected, remaining, isOverdue };
    }).filter(row => {
      const haystack = `${row.student?.name ?? ''} ${row.student?.email ?? ''} ${row.plan?.name ?? ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [accounts, installments, paymentTotalsByAccount, plans, search, users]);

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await action();
      setPlanFormOpen(false);
      setPaymentFormOpen(false);
      setInstallmentFormOpen(false);
      setAccountFormOpen(false);
    } finally {
      setSaving(false);
    }
  };
  const outstandingAccountIds = accountRows.filter(row => row.remaining > 0).map(row => row.account.id);

  const Header = (
    <div className="rounded-3xl border border-[#e5e5e5] bg-[#fafafa] p-5 shadow-[0_18px_50px_rgba(23,23,23,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
            <Banknote className="h-3.5 w-3.5 text-[#15803d]" />
            Tuition
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#171717]">Tuition</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737373]">
            Track student tuition, installments, payments received, and reminders from one admin workspace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
          <button type="button" onClick={() => setAccountFormOpen(true)} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 font-semibold text-[#525252] hover:bg-[#f5f5f5]">
            <Users className="h-4 w-4" />
            Add student
          </button>
          <button type="button" onClick={() => setPaymentFormOpen(true)} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 font-semibold text-[#15803d] hover:bg-[#dcfce7]">
            <CreditCard className="h-4 w-4" />
            Record payment
          </button>
          <button type="button" onClick={() => setPlanFormOpen(true)} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 py-2 font-semibold text-white hover:bg-[#262626]">
            <Plus className="h-4 w-4" />
            New plan
          </button>
        </div>
      </div>
    </div>
  );

  const stats = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Collected" value={currency(summary.collected, activeCurrency)} detail="Payments recorded" icon={CheckCircle2} tone="green" />
      <StatCard label="Remaining" value={currency(summary.remaining, activeCurrency)} detail="Still outstanding" icon={AlertCircle} tone="amber" />
      <StatCard label="Overdue" value={String(summary.overdueStudents)} detail="Students need follow-up" icon={Bell} tone="rose" />
      <StatCard label="Next installment" value={summary.nextInstallment ? formatPlatformDate(summary.nextInstallment.dueDate) : 'Not set'} detail={summary.nextInstallment?.title ?? 'Add installment dates'} icon={CalendarDays} tone="blue" />
    </div>
  );

  const studentsTable = (
    <SectionCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#171717]">Student tuition</h2>
          <p className="text-sm text-[#737373]">Outstanding balances and payment progress.</p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students" className="h-10 w-full rounded-xl border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eeeeee]">
            {accountRows.map(row => (
              <tr key={row.account.id} className="bg-white hover:bg-[#fafafa]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={row.student} size="sm" />
                    <div>
                      <p className="font-semibold text-[#171717]">{row.student?.name ?? 'Unknown student'}</p>
                      <p className="text-xs text-[#737373]">{row.student?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#525252]">{row.plan?.name ?? 'No plan'}</td>
                <td className="px-4 py-3 font-medium text-[#171717]">{currency(row.expected, row.plan?.currency)}</td>
                <td className="px-4 py-3 text-[#15803d]">{currency(row.paid, row.plan?.currency)}</td>
                <td className="px-4 py-3 text-[#c2410c]">{currency(row.remaining, row.plan?.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.remaining <= 0 ? 'bg-[#dcfce7] text-[#166534]' : row.isOverdue ? 'bg-[#fee2e2] text-[#b91c1c]' : row.paid > 0 ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#f5f5f5] text-[#525252]'}`}>
                    {row.remaining <= 0 ? 'Paid' : row.isOverdue ? 'Overdue' : row.paid > 0 ? 'Part paid' : 'Open'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => void run(() => onSendReminder([row.account.id], null))} className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-1.5 text-xs font-semibold text-[#c2410c] hover:bg-[#ffedd5]">
                    <Bell className="h-3.5 w-3.5" />
                    Send
                  </button>
                </td>
              </tr>
            ))}
            {accountRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#737373]">No tuition accounts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );

  const plansPanel = (
    <div className="grid gap-4">
      <SectionCard className="order-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#171717]">Installments</h2>
          <button
            type="button"
            onClick={() => setInstallmentFormOpen(true)}
            className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {installments.map(item => {
            const plan = plans.find(planItem => planItem.id === item.planId);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
                <div>
                  <p className="font-semibold text-[#171717]">{item.title}</p>
                  <p className="text-xs text-[#737373]">{plan?.name ?? 'Plan'} · due {formatPlatformDate(item.dueDate)}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">{currency(item.amount, plan?.currency)}</span>
              </div>
            );
          })}
          {installments.length === 0 ? <p className="rounded-xl bg-[#fafafa] p-4 text-sm text-[#737373]">No installments configured yet.</p> : null}
        </div>
      </SectionCard>
      <SectionCard className="order-1 p-4">
        <h2 className="text-lg font-semibold text-[#171717]">Plans</h2>
        <div className="mt-4 space-y-2">
          {plans.map(plan => {
            const course = courses.find(item => item.id === plan.courseId);
            return (
              <div key={plan.id} className="rounded-xl border border-[#eeeeee] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#171717]">{plan.name}</p>
                    <p className="mt-1 text-xs text-[#737373]">{course ? <ActiveYearGroupBadge course={course} /> : 'All students'}</p>
                  </div>
                  <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d]">{currency(plan.totalAmount, plan.currency)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );

  const paymentsPanel = (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
        <h2 className="text-lg font-semibold text-[#171717]">Payments received</h2>
      </div>
      <div className="divide-y divide-[#eeeeee]">
        {payments.map(payment => {
          const student = users.find(user => user.id === payment.studentId);
          const account = accounts.find(item => item.id === payment.accountId);
          const plan = plans.find(item => item.id === account?.planId);
          return (
            <div key={payment.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex items-center gap-3">
                <UserAvatar user={student ?? null} size="sm" />
                <div>
                  <p className="font-semibold text-[#171717]">{student?.name ?? 'Unknown student'}</p>
                  <p className="text-xs text-[#737373]">{formatPlatformDate(payment.paymentDate)} · {payment.method}</p>
                </div>
              </div>
              <p className="font-semibold text-[#15803d]">{currency(payment.amount, plan?.currency)}</p>
            </div>
          );
        })}
        {payments.length === 0 ? <p className="p-8 text-center text-sm text-[#737373]">No payments recorded yet.</p> : null}
      </div>
    </SectionCard>
  );

  const remindersPanel = (
    <SectionCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
        <h2 className="text-lg font-semibold text-[#171717]">Reminders</h2>
        <button type="button" onClick={() => setConfirmOutstandingOpen(true)} disabled={outstandingAccountIds.length === 0} className="tbo-focus inline-flex items-center gap-2 rounded-xl bg-[#171717] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Bell className="h-4 w-4" />
          Remind outstanding
        </button>
      </div>
      <div className="divide-y divide-[#eeeeee]">
        {reminders.map(reminder => {
          const student = users.find(user => user.id === reminder.studentId);
          return (
            <div key={reminder.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[#171717]">{reminder.subject}</p>
                <p className="text-xs text-[#737373]">{student?.name ?? 'Unknown student'} · {formatPlatformDate(reminder.createdAt.slice(0, 10))}</p>
              </div>
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">{reminder.status}</span>
            </div>
          );
        })}
        {reminders.length === 0 ? <p className="p-8 text-center text-sm text-[#737373]">No reminders queued yet.</p> : null}
      </div>
    </SectionCard>
  );

  const settingsPanel = (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard className="p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#525252]" />
          <h2 className="text-lg font-semibold text-[#171717]">Defaults</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#737373]">Create plans to set currency, tuition amount, and installment dates. The active plan becomes the default for new student accounts.</p>
      </SectionCard>
      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-[#171717]">Reminder template</h2>
        <p className="mt-3 text-sm leading-6 text-[#737373]">Tuition reminders use the platform email queue. The message includes the remaining amount and installment due date when one is selected.</p>
      </SectionCard>
    </div>
  );

  return (
    <div className="space-y-5">
      {Header}
      {error ? <SectionCard className="border-[#fecaca] bg-[#fef2f2] p-4 text-sm font-medium text-[#b91c1c]">{error}</SectionCard> : null}
      {loading ? <SectionCard className="p-8 text-center text-sm text-[#737373]">Loading tuition...</SectionCard> : null}
      {activeSection === 'overview' ? stats : null}
      {activeSection === 'overview' ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"><div>{studentsTable}</div><div>{plansPanel}</div></div> : null}
      {activeSection === 'students' ? studentsTable : null}
      {activeSection === 'payments' ? paymentsPanel : null}
      {activeSection === 'installments' ? plansPanel : null}
      {activeSection === 'reminders' ? remindersPanel : null}
      {activeSection === 'settings' ? settingsPanel : null}

      {planFormOpen ? (
        <TuitionModal title="New tuition plan" onClose={() => setPlanFormOpen(false)}>
          <TuitionPlanForm courses={courses} saving={saving} onSubmit={input => run(() => onCreatePlan(input))} />
        </TuitionModal>
      ) : null}
      {accountFormOpen ? (
        <TuitionModal title="Add student to tuition" onClose={() => setAccountFormOpen(false)}>
          <TuitionAccountForm
            students={activeStudents}
            firstYearStudents={activeStudentsByCourseType.firstYear}
            secondYearStudents={activeStudentsByCourseType.secondYear}
            plans={plans}
            saving={saving}
            onSubmit={input => run(() => Promise.all(input.studentIds.map(studentId => onEnrollStudent({
              studentId,
              planId: input.planId,
              expectedAmount: input.expectedAmount,
            }))))}
          />
        </TuitionModal>
      ) : null}
      {paymentFormOpen ? (
        <TuitionModal title="Record payment" onClose={() => setPaymentFormOpen(false)}>
          <TuitionPaymentForm rows={accountRows} saving={saving} onSubmit={input => run(() => onRecordPayment(input))} />
        </TuitionModal>
      ) : null}
      {installmentFormOpen ? (
        <TuitionModal title="Add installment" onClose={() => setInstallmentFormOpen(false)}>
          <TuitionInstallmentForm plans={plans} saving={saving} onSubmit={input => run(() => onUpsertInstallment(input))} />
        </TuitionModal>
      ) : null}
      {confirmOutstandingOpen ? (
        <TuitionModal title="Send tuition reminders?" onClose={() => setConfirmOutstandingOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-6 text-[#7c2d12]">
              <p className="font-semibold text-[#9a3412]">
                This will queue reminder emails for {outstandingAccountIds.length} student{outstandingAccountIds.length === 1 ? '' : 's'} with an outstanding tuition balance.
              </p>
              <p className="mt-2">
                Each email will include the student name, remaining amount, and tuition reminder text. Students who are fully paid will not receive this reminder.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOutstandingOpen(false)}
                className="tbo-focus rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#fafafa]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || outstandingAccountIds.length === 0}
                onClick={() => void run(async () => {
                  await onSendReminder(outstandingAccountIds, null);
                  setConfirmOutstandingOpen(false);
                })}
                className="tbo-focus inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                Send reminders
              </button>
            </div>
          </div>
        </TuitionModal>
      ) : null}
    </div>
  );
}

function TuitionModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close" />
      <section className="relative w-full max-w-xl rounded-t-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:rounded-2xl">
        <h3 className="text-lg font-semibold text-[#171717]">{title}</h3>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

function TuitionPlanForm({ courses, saving, onSubmit }: { courses: Course[]; saving: boolean; onSubmit: (input: { name: string; courseId?: number | null; academicYear?: string | null; currency: string; totalAmount: number; firstDueDate?: string; secondDueDate?: string }) => void }) {
  const [name, setName] = useState('Annual tuition');
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState('0');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [secondDueDate, setSecondDueDate] = useState('');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ name, courseId: courseId ? Number(courseId) : null, currency: 'EUR', totalAmount: Number(amount), firstDueDate, secondDueDate }); }}>
      <input value={name} onChange={event => setName(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" placeholder="Plan name" required />
      <select value={courseId} onChange={event => setCourseId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm">
        <option value="">All active students</option>
        {courses.filter(course => course.status === 'active').map(course => <option key={course.id} value={course.id}>{course.courseType === 'first_year' ? 'First Year' : 'Second Year'} {course.graduationYear}</option>)}
      </select>
      <label className="block text-xs font-semibold text-[#737373]">
        Total tuition amount
        <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
          <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
          <input
            value={amount}
            onChange={event => setAmount(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none"
            placeholder="Total for this plan"
            required
          />
        </div>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#737373]">First installment<input value={firstDueDate} onChange={event => setFirstDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" /></label>
        <label className="text-xs font-semibold text-[#737373]">Second installment<input value={secondDueDate} onChange={event => setSecondDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" /></label>
      </div>
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Create plan</button>
    </form>
  );
}

function TuitionAccountForm({
  students,
  firstYearStudents,
  secondYearStudents,
  plans,
  saving,
  onSubmit,
}: {
  students: User[];
  firstYearStudents: User[];
  secondYearStudents: User[];
  plans: TuitionPlan[];
  saving: boolean;
  onSubmit: (input: { studentIds: string[]; planId: number; expectedAmount?: number }) => void;
}) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Array<'first_year' | 'second_year'>>([]);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const plan = plans.find(item => item.id === Number(planId));
  const firstYearIds = firstYearStudents.map(student => student.id);
  const secondYearIds = secondYearStudents.map(student => student.id);
  const selectedGroupIds = [
    ...(selectedGroups.includes('first_year') ? firstYearIds : []),
    ...(selectedGroups.includes('second_year') ? secondYearIds : []),
  ];
  const effectiveSelectedStudentIds = Array.from(new Set([...selectedGroupIds, ...selectedStudentIds]));
  const visibleIndividualStudents = students.filter(student => {
    if (selectedGroups.includes('first_year') && firstYearIds.includes(student.id)) return false;
    if (selectedGroups.includes('second_year') && secondYearIds.includes(student.id)) return false;
    return true;
  });
  const toggleGroup = (group: 'first_year' | 'second_year') => {
    const idsToRemove = group === 'first_year' ? firstYearIds : secondYearIds;
    setSelectedGroups(current => current.includes(group)
      ? current.filter(value => value !== group)
      : [...current, group]
    );
    setSelectedStudentIds(current => current.filter(id => !idsToRemove.includes(id)));
  };
  const toggleStudent = (id: string) => {
    setSelectedStudentIds(current => current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id]
    );
  };

  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ studentIds: effectiveSelectedStudentIds, planId: Number(planId), expectedAmount: plan?.totalAmount }); }}>
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Students</p>
        <button
          type="button"
          onClick={() => setStudentPickerOpen(open => !open)}
          className="tbo-focus mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm"
        >
          <span className={effectiveSelectedStudentIds.length > 0 ? 'font-semibold text-[#171717]' : 'text-[#737373]'}>
            {effectiveSelectedStudentIds.length > 0
              ? `${effectiveSelectedStudentIds.length} selected`
              : 'Choose year groups or individual students'}
          </span>
          <span className="text-xs font-semibold text-[#737373]">{studentPickerOpen ? 'Close' : 'Open'}</span>
        </button>
        {studentPickerOpen ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white p-2 shadow-[0_18px_50px_rgba(23,23,23,0.16)]">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: 'first_year' as const, label: 'First Year', count: firstYearStudents.length },
                { id: 'second_year' as const, label: 'Second Year', count: secondYearStudents.length },
              ].map(group => {
                const selected = selectedGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    disabled={group.count === 0}
                    className={`tbo-focus flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? 'border-[#86efac] bg-[#f0fdf4] text-[#15803d]'
                        : 'border-[#e5e5e5] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded border text-[10px] font-bold ${
                      selected ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-[#cbd5e1] bg-white text-transparent'
                    }`}>
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{group.label}</span>
                      <span className="text-xs text-[#737373]">{group.count} student{group.count === 1 ? '' : 's'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="my-2 border-t border-[#eeeeee]" />
            {visibleIndividualStudents.map(student => {
              const selected = selectedStudentIds.includes(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggleStudent(student.id)}
                  className={`tbo-focus flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                    selected ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'hover:bg-[#fafafa]'
                  }`}
                >
                  <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded border text-[10px] font-bold ${
                    selected ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-[#cbd5e1] bg-white text-transparent'
                  }`}>
                    ✓
                  </span>
                  <UserAvatar user={student} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{student.name}</span>
                    <span className="block truncate text-xs text-[#737373]">{student.email}</span>
                  </span>
                </button>
              );
            })}
            {visibleIndividualStudents.length === 0 ? (
              <p className="rounded-xl bg-[#fafafa] px-3 py-4 text-center text-sm text-[#737373]">
                Individual students are hidden because selected year groups already include them.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {effectiveSelectedStudentIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#fafafa] p-2 ring-1 ring-[#eeeeee]">
          {selectedGroups.includes('first_year') ? <button type="button" onClick={() => toggleGroup('first_year')} className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">First Year x</button> : null}
          {selectedGroups.includes('second_year') ? <button type="button" onClick={() => toggleGroup('second_year')} className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">Second Year x</button> : null}
          {selectedStudentIds.slice(0, 8).map(id => {
            const student = students.find(item => item.id === id);
            return (
              <button key={id} type="button" onClick={() => toggleStudent(id)} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                {student?.name ?? 'Student'} x
              </button>
            );
          })}
          {effectiveSelectedStudentIds.length > selectedStudentIds.slice(0, 8).length + selectedGroups.length ? <span className="rounded-full bg-[#171717] px-2.5 py-1 text-xs font-semibold text-white">{effectiveSelectedStudentIds.length} total</span> : null}
        </div>
      ) : null}
      <select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">Choose plan</option>
        {plans.map(planItem => <option key={planItem.id} value={planItem.id}>{planItem.name} - {currency(planItem.totalAmount, planItem.currency)}</option>)}
      </select>
      <button disabled={saving || !plans.length || effectiveSelectedStudentIds.length === 0} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        Add {effectiveSelectedStudentIds.length || ''} tuition account{effectiveSelectedStudentIds.length === 1 ? '' : 's'}
      </button>
    </form>
  );
}
function TuitionPaymentForm({ rows, saving, onSubmit }: { rows: Array<{ account: StudentTuitionAccount; student: User | null; remaining: number; plan: TuitionPlan | null }>; saving: boolean; onSubmit: (input: { accountId: number; amount: number; paymentDate: string; method: string; reference?: string; note?: string }) => void }) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayKey());
  const [method, setMethod] = useState('cash');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ accountId: Number(accountId), amount: Number(amount), paymentDate, method }); }}>
      <select value={accountId} onChange={event => { setAccountId(event.target.value); const row = rows.find(item => item.account.id === Number(event.target.value)); setAmount(row?.remaining ? String(row.remaining) : ''); }} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">Choose student account</option>
        {rows.map(row => <option key={row.account.id} value={row.account.id}>{row.student?.name ?? 'Unknown'} · remaining {currency(row.remaining, row.plan?.currency)}</option>)}
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#737373]">
          Payment amount
          <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
            <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none" placeholder="Amount received" required />
          </div>
        </label>
        <label className="block text-xs font-semibold text-[#737373]">
          Payment date
          <input value={paymentDate} onChange={event => setPaymentDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" required />
        </label>
      </div>
      <select value={method} onChange={event => setMethod(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm">
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="card">Card</option>
        <option value="other">Other</option>
      </select>
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save payment</button>
    </form>
  );
}

function TuitionInstallmentForm({ plans, saving, onSubmit }: { plans: TuitionPlan[]; saving: boolean; onSubmit: (input: { planId: number; title: string; amount: number; dueDate: string }) => void }) {
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ planId: Number(planId), title, amount: Number(amount), dueDate }); }}>
      <select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">Choose plan</option>
        {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <input value={title} onChange={event => setTitle(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" placeholder="Installment title" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#737373]">
          Installment amount
          <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
            <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none" placeholder="Amount due" required />
          </div>
        </label>
        <label className="block text-xs font-semibold text-[#737373]">
          Due date
          <input value={dueDate} onChange={event => setDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" required />
        </label>
      </div>
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save installment</button>
    </form>
  );
}
