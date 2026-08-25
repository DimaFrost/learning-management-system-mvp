import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  RotateCcw,
  Save,
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
import type { TuitionEmailTemplate, TuitionEmailTemplates, TuitionSummary } from '../../hooks/useTuition';
import { DEFAULT_TUITION_EMAIL_TEMPLATES } from '../../hooks/useTuition';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatCurrency } from '../../i18n/formatters';
import { formatPlatformDate, toLocalDateKey } from '../../utils/dateUtils';
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
  emailTemplates: TuitionEmailTemplates;
  loading: boolean;
  error: string | null;
  onOpenStudentDashboard?: (studentId: string) => void;
  quickAddAction?: 'payment';
  onCreatePlan: (input: {
    name: string;
    courseId?: number | null;
    academicYear?: string | null;
    currency: string;
    totalAmount: number;
    firstDueDate?: string;
    secondDueDate?: string;
  }) => Promise<unknown>;
  onUpdatePlan: (id: number, input: {
    name: string;
    courseId?: number | null;
    academicYear?: string | null;
    currency: string;
    totalAmount: number;
    status: TuitionPlan['status'];
  }) => Promise<void>;
  onUpsertInstallment: (input: Partial<TuitionInstallment> & { planId: number; title: string; amount: number; dueDate: string }) => Promise<void>;
  onEnrollStudent: (input: { studentId: string; planId: number; expectedAmount?: number; discountAmount?: number; notes?: string }) => Promise<void>;
  onRecordPayment: (input: { accountId: number; amount: number; paymentDate: string; method: string; reference?: string; note?: string }) => Promise<void>;
  onSendReminder: (accountIds: number[], installmentId?: number | null) => Promise<void>;
  onUpdateEmailTemplate: (key: keyof TuitionEmailTemplates, template: TuitionEmailTemplate) => Promise<void>;
};

function currency(amount: number, code = 'EUR') {
  return formatCurrency(amount, code);
}

function todayKey() {
  return toLocalDateKey();
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
  emailTemplates,
  loading,
  error,
  onOpenStudentDashboard,
  quickAddAction,
  onCreatePlan,
  onUpdatePlan,
  onUpsertInstallment,
  onEnrollStudent,
  onRecordPayment,
  onSendReminder,
  onUpdateEmailTemplate,
}: TuitionViewProps) {
  const { t, tCount } = useLanguage();
  const [search, setSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentYearFilter, setPaymentYearFilter] = useState('all');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TuitionPlan | null>(null);
  const [paymentFormOpen, setPaymentFormOpen] = useState(quickAddAction === 'payment');
  const [installmentFormOpen, setInstallmentFormOpen] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [confirmOutstandingOpen, setConfirmOutstandingOpen] = useState(false);
  const [confirmReminderAccountId, setConfirmReminderAccountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const defaultPlan = plans.find(plan => plan.status === 'active') ?? plans[0] ?? null;
  const activeCurrency = defaultPlan?.currency ?? 'EUR';
  const activeFirstYearCourse = courses.find(course => course.status === 'active' && course.courseType === 'first_year') ?? null;
  const activeSecondYearCourse = courses.find(course => course.status === 'active' && course.courseType === 'second_year') ?? null;
  const firstYearStudentIds = useMemo(
    () => new Set(activeStudentsByCourseType.firstYear.map(student => student.id)),
    [activeStudentsByCourseType.firstYear]
  );
  const secondYearStudentIds = useMemo(
    () => new Set(activeStudentsByCourseType.secondYear.map(student => student.id)),
    [activeStudentsByCourseType.secondYear]
  );

  const accountRows = useMemo(() => {
    return accounts.map(account => {
      const student = users.find(user => user.id === account.studentId) ?? null;
      const plan = plans.find(item => item.id === account.planId) ?? null;
      const yearCourse = firstYearStudentIds.has(account.studentId)
        ? activeFirstYearCourse
        : secondYearStudentIds.has(account.studentId)
          ? activeSecondYearCourse
          : null;
      const paid = paymentTotalsByAccount.get(account.id) ?? 0;
      const expected = Math.max(0, account.expectedAmount - account.discountAmount);
      const remaining = Math.max(0, expected - paid);
      const planInstallments = installments.filter(item => item.planId === account.planId);
      const isOverdue = remaining > 0 && planInstallments.some(item => item.dueDate < todayKey());
      return { account, student, plan, yearCourse, paid, expected, remaining, isOverdue };
    }).filter(row => {
      const haystack = `${row.student?.name ?? ''} ${row.student?.email ?? ''} ${row.student?.studentNumber ?? ''} ${row.plan?.name ?? ''} ${row.account.notes ?? ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [accounts, activeFirstYearCourse, activeSecondYearCourse, firstYearStudentIds, installments, paymentTotalsByAccount, plans, search, secondYearStudentIds, users]);

  const getStudentYearCourse = (studentId: string | null | undefined) => {
    if (!studentId) return null;
    if (firstYearStudentIds.has(studentId)) return activeFirstYearCourse;
    if (secondYearStudentIds.has(studentId)) return activeSecondYearCourse;
    return null;
  };

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'cash':
        return t('tuition.form.method.cash');
      case 'card':
        return t('tuition.form.method.card');
      case 'bank_transfer':
        return t('tuition.form.method.bankTransfer');
      default:
        return t('tuition.form.method.other');
    }
  };

  const paymentRows = useMemo(() => payments.map((payment, index) => {
    const student = users.find(user => user.id === payment.studentId) ?? null;
    const account = accounts.find(item => item.id === payment.accountId) ?? null;
    const plan = plans.find(item => item.id === account?.planId) ?? null;
    const yearCourse = getStudentYearCourse(payment.studentId);
    const planInstallments = installments
      .filter(item => item.planId === account?.planId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const installmentIndex = planInstallments.findIndex(item => payment.paymentDate <= item.dueDate);
    const installmentNumber = installmentIndex >= 0
      ? installmentIndex + 1
      : planInstallments.length > 0
        ? planInstallments.length
        : null;
    return { payment, index, student, account, plan, yearCourse, installmentNumber };
  }).filter(row => {
    const searchNeedle = paymentSearch.trim().toLowerCase();
    const haystack = `${row.student?.name ?? ''} ${row.student?.email ?? ''} ${row.student?.studentNumber ?? ''} ${row.plan?.name ?? ''} ${row.payment.method} ${row.payment.note ?? ''} ${row.payment.reference ?? ''}`.toLowerCase();
    const matchesSearch = !searchNeedle || haystack.includes(searchNeedle);
    const matchesMethod = paymentMethodFilter === 'all' || row.payment.method === paymentMethodFilter;
    const matchesYear = paymentYearFilter === 'all' || row.yearCourse?.courseType === paymentYearFilter;
    const matchesFrom = !paymentDateFrom || row.payment.paymentDate >= paymentDateFrom;
    const matchesTo = !paymentDateTo || row.payment.paymentDate <= paymentDateTo;
    return matchesSearch && matchesMethod && matchesYear && matchesFrom && matchesTo;
  }), [accounts, activeFirstYearCourse, activeSecondYearCourse, firstYearStudentIds, installments, paymentDateFrom, paymentDateTo, paymentMethodFilter, paymentSearch, paymentYearFilter, payments, plans, secondYearStudentIds, users]);

  const paymentsFiltered = paymentRows.length !== payments.length;
  const clearPaymentFilters = () => {
    setPaymentSearch('');
    setPaymentMethodFilter('all');
    setPaymentYearFilter('all');
    setPaymentDateFrom('');
    setPaymentDateTo('');
  };

  const paymentMethodTotals = useMemo(() => payments.reduce((totals, payment) => {
    const key = payment.method === 'card' || payment.method === 'bank_transfer' || payment.method === 'cash'
      ? payment.method
      : 'other';
    totals[key] = (totals[key] ?? 0) + payment.amount;
    return totals;
  }, {} as Record<string, number>), [payments]);

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
  const confirmReminderRow = confirmReminderAccountId
    ? accountRows.find(row => row.account.id === confirmReminderAccountId) ?? null
    : null;

  const Header = (
    <div className="rounded-3xl border border-[#e5e5e5] bg-[#fafafa] p-5 shadow-[0_18px_50px_rgba(23,23,23,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
            <Banknote className="h-3.5 w-3.5 text-[#15803d]" />
            {t('tuition.title')}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#171717]">{t('tuition.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737373]">
            {t('tuition.description')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
          <button type="button" onClick={() => setAccountFormOpen(true)} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 font-semibold text-[#525252] hover:bg-[#f5f5f5]">
            <Users className="h-4 w-4" />
            {t('tuition.addStudent')}
          </button>
          <button type="button" onClick={() => setPaymentFormOpen(true)} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 font-semibold text-[#15803d] hover:bg-[#dcfce7]">
            <CreditCard className="h-4 w-4" />
            {t('tuition.recordPayment')}
          </button>
          <button type="button" onClick={() => { setEditingPlan(null); setPlanFormOpen(true); }} className="tbo-focus inline-flex items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 py-2 font-semibold text-white hover:bg-[#262626]">
            <Plus className="h-4 w-4" />
            {t('tuition.newPlan')}
          </button>
        </div>
      </div>
    </div>
  );

  const stats = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t('tuition.stat.collected')} value={currency(summary.collected, activeCurrency)} detail={t('tuition.stat.collectedDetail')} icon={CheckCircle2} tone="green" />
      <StatCard label={t('tuition.stat.remaining')} value={currency(summary.remaining, activeCurrency)} detail={t('tuition.stat.remainingDetail')} icon={AlertCircle} tone="amber" />
      <StatCard label={t('tuition.stat.overdue')} value={String(summary.overdueStudents)} detail={t('tuition.stat.overdueDetail')} icon={Bell} tone="rose" />
      <StatCard label={t('tuition.stat.nextInstallment')} value={summary.nextInstallment ? formatPlatformDate(summary.nextInstallment.dueDate) : t('tuition.stat.notSet')} detail={summary.nextInstallment?.title ?? t('tuition.stat.addInstallmentDates')} icon={CalendarDays} tone="blue" />
    </div>
  );

  const studentsTable = (
    <SectionCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.studentTuition.title')}</h2>
          <p className="text-sm text-[#737373]">{t('tuition.studentTuition.subtitle')}</p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('tuition.searchStudents')} className="h-10 w-full rounded-xl border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
            <tr>
              <th className="px-4 py-3">{t('tuition.table.student')}</th>
              <th className="px-4 py-3">{t('tuition.table.studentNumber')}</th>
              <th className="px-4 py-3">{t('tuition.table.year')}</th>
              <th className="px-4 py-3">{t('tuition.table.plan')}</th>
              <th className="px-4 py-3">{t('tuition.table.expected')}</th>
              <th className="px-4 py-3">{t('tuition.table.paid')}</th>
              <th className="px-4 py-3">{t('tuition.table.remaining')}</th>
              <th className="px-4 py-3">{t('tuition.table.notes')}</th>
              <th className="px-4 py-3">{t('common.status')}</th>
              <th className="px-4 py-3 text-right">{t('tuition.table.reminder')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eeeeee]">
            {accountRows.map(row => (
              <tr key={row.account.id} className="bg-white hover:bg-[#fafafa]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={row.student} size="sm" />
                    <div>
                      <p className="font-semibold text-[#171717]">{row.student?.name ?? t('tuition.unknownStudent')}</p>
                      <p className="text-xs text-[#737373]">{row.student?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.student?.studentNumber ? (
                    <span className="font-mono text-xs font-semibold tracking-[0.08em] text-[#404040]">{row.student.studentNumber}</span>
                  ) : (
                    <span className="text-[#a3a3a3]">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.yearCourse ? <ActiveYearGroupBadge course={row.yearCourse} /> : <span className="text-[#a3a3a3]">-</span>}
                </td>
                <td className="px-4 py-3 text-[#525252]">{row.plan?.name ?? t('tuition.noPlan')}</td>
                <td className="px-4 py-3 font-medium text-[#171717]">{currency(row.expected, row.plan?.currency)}</td>
                <td className="px-4 py-3 text-[#15803d]">{currency(row.paid, row.plan?.currency)}</td>
                <td className="px-4 py-3 text-[#c2410c]">{currency(row.remaining, row.plan?.currency)}</td>
                <td className="max-w-[14rem] px-4 py-3 text-xs leading-5 text-[#737373]">
                  {row.account.notes?.trim() ? (
                    <span className="line-clamp-2">{row.account.notes}</span>
                  ) : (
                    <span className="text-[#a3a3a3]">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.remaining <= 0 ? 'bg-[#dcfce7] text-[#166534]' : row.isOverdue ? 'bg-[#fee2e2] text-[#b91c1c]' : row.paid > 0 ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#f5f5f5] text-[#525252]'}`}>
                    {row.remaining <= 0 ? t('tuition.status.paid') : row.isOverdue ? t('common.overdue') : row.paid > 0 ? t('tuition.status.partPaid') : t('tuition.status.open')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setConfirmReminderAccountId(row.account.id)} className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-1.5 text-xs font-semibold text-[#c2410c] hover:bg-[#ffedd5]">
                    <Bell className="h-3.5 w-3.5" />
                    {t('common.send')}
                  </button>
                </td>
              </tr>
            ))}
            {accountRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#737373]">{t('tuition.noAccounts')}</td>
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
          <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.installments')}</h2>
          <button
            type="button"
            onClick={() => setInstallmentFormOpen(true)}
            className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('tuition.add')}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {installments.map(item => {
            const plan = plans.find(planItem => planItem.id === item.planId);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
                <div>
                  <p className="font-semibold text-[#171717]">{item.title}</p>
                  <p className="text-xs text-[#737373]">{t('tuition.installmentDue', { plan: plan?.name ?? t('tuition.table.plan'), date: formatPlatformDate(item.dueDate) })}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">{currency(item.amount, plan?.currency)}</span>
              </div>
            );
          })}
          {installments.length === 0 ? <p className="rounded-xl bg-[#fafafa] p-4 text-sm text-[#737373]">{t('tuition.noInstallments')}</p> : null}
        </div>
      </SectionCard>
      <SectionCard className="order-1 p-4">
        <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.plans')}</h2>
        <div className="mt-4 space-y-2">
          {plans.map(plan => {
            const course = courses.find(item => item.id === plan.courseId);
            return (
              <div key={plan.id} className="rounded-xl border border-[#eeeeee] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#171717]">{plan.name}</p>
                    <p className="mt-1 text-xs text-[#737373]">{course ? <ActiveYearGroupBadge course={course} /> : t('tuition.allStudents')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d]">{currency(plan.totalAmount, plan.currency)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(plan);
                        setPlanFormOpen(true);
                      }}
                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#fafafa] hover:text-[#171717]"
                      aria-label={t('tuition.editPlan')}
                      title={t('tuition.editPlan')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.paymentsReceived')}</h2>
            <p className="text-sm text-[#737373]">{t('tuition.transactionLog')}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: t('tuition.paymentTotal.cash'), value: paymentMethodTotals.cash ?? 0, tone: 'bg-[#f0fdf4] text-[#15803d] ring-[#bbf7d0]' },
              { label: t('tuition.paymentTotal.card'), value: paymentMethodTotals.card ?? 0, tone: 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]' },
              { label: t('tuition.paymentTotal.bank'), value: paymentMethodTotals.bank_transfer ?? 0, tone: 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl px-3 py-2 ring-1 ${item.tone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">{item.label}</p>
                <p className="mt-1 text-sm font-semibold">{currency(item.value, activeCurrency)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
            <input
              value={paymentSearch}
              onChange={event => setPaymentSearch(event.target.value)}
              placeholder={t('tuition.paymentFilters.search')}
              className="h-10 w-full rounded-xl border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <select value={paymentMethodFilter} onChange={event => setPaymentMethodFilter(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#525252] outline-none focus:ring-2 focus:ring-[#bfdbfe]">
            <option value="all">{t('tuition.paymentFilters.allMethods')}</option>
            <option value="cash">{t('tuition.form.method.cash')}</option>
            <option value="card">{t('tuition.form.method.card')}</option>
            <option value="bank_transfer">{t('tuition.form.method.bankTransfer')}</option>
            <option value="other">{t('tuition.form.method.other')}</option>
          </select>
          <select value={paymentYearFilter} onChange={event => setPaymentYearFilter(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#525252] outline-none focus:ring-2 focus:ring-[#bfdbfe]">
            <option value="all">{t('tuition.paymentFilters.allYears')}</option>
            <option value="first_year">{t('common.yearGroup.first')}</option>
            <option value="second_year">{t('common.yearGroup.second')}</option>
          </select>
          <input
            value={paymentDateFrom}
            onChange={event => setPaymentDateFrom(event.target.value)}
            type="date"
            aria-label={t('tuition.paymentFilters.from')}
            className="h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#525252] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <input
            value={paymentDateTo}
            onChange={event => setPaymentDateTo(event.target.value)}
            type="date"
            aria-label={t('tuition.paymentFilters.to')}
            className="h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#525252] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <button
            type="button"
            onClick={clearPaymentFilters}
            disabled={!paymentsFiltered}
            className="tbo-focus h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t('common.clear')}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
            <tr>
              <th className="px-4 py-3">{t('tuition.table.no')}</th>
              <th className="px-4 py-3">{t('tuition.table.date')}</th>
              <th className="px-4 py-3">{t('tuition.table.studentId')}</th>
              <th className="px-4 py-3">{t('tuition.table.studentName')}</th>
              <th className="px-4 py-3">{t('tuition.table.year')}</th>
              <th className="px-4 py-3">{t('tuition.table.amount')}</th>
              <th className="px-4 py-3">{t('tuition.table.method')}</th>
              <th className="px-4 py-3">{t('tuition.table.installmentNumber')}</th>
              <th className="px-4 py-3">{t('tuition.table.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eeeeee]">
            {paymentRows.map(row => (
              <tr key={row.payment.id} className="bg-white hover:bg-[#fafafa]">
                <td className="px-4 py-3 font-mono text-xs text-[#737373]">{row.index + 1}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[#525252]">{formatPlatformDate(row.payment.paymentDate)}</td>
                <td className="px-4 py-3">
                  {row.student?.studentNumber ? (
                    <span className="font-mono text-xs font-semibold tracking-[0.08em] text-[#404040]">{row.student.studentNumber}</span>
                  ) : (
                    <span className="text-[#a3a3a3]">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={row.student} size="sm" />
                    <span className="font-semibold text-[#171717]">{row.student?.name ?? t('tuition.unknownStudent')}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{row.yearCourse ? <ActiveYearGroupBadge course={row.yearCourse} /> : <span className="text-[#a3a3a3]">-</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#15803d]">{currency(row.payment.amount, row.plan?.currency)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#525252]">
                    {formatPaymentMethod(row.payment.method)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-[#525252]">{row.installmentNumber ?? '-'}</td>
                <td className="max-w-[16rem] px-4 py-3 text-xs leading-5 text-[#737373]">
                  {row.payment.note?.trim() ? <span className="line-clamp-2">{row.payment.note}</span> : <span className="text-[#a3a3a3]">-</span>}
                </td>
              </tr>
            ))}
            {paymentRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#737373]">{t('tuition.noPayments')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );

  const remindersPanel = (
    <SectionCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
        <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.reminders')}</h2>
        <button type="button" onClick={() => setConfirmOutstandingOpen(true)} disabled={outstandingAccountIds.length === 0} className="tbo-focus inline-flex items-center gap-2 rounded-xl bg-[#171717] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Bell className="h-4 w-4" />
          {t('tuition.remindOutstanding')}
        </button>
      </div>
      <div className="divide-y divide-[#eeeeee]">
        {reminders.map(reminder => {
          const student = users.find(user => user.id === reminder.studentId);
          return (
            <div key={reminder.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[#171717]">{reminder.subject}</p>
                <p className="text-xs text-[#737373]">{student?.name ?? t('tuition.unknownStudent')} · {formatPlatformDate(reminder.createdAt.slice(0, 10))}</p>
              </div>
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">{reminder.status}</span>
            </div>
          );
        })}
        {reminders.length === 0 ? <p className="p-8 text-center text-sm text-[#737373]">{t('tuition.noReminders')}</p> : null}
      </div>
    </SectionCard>
  );

  const settingsPanel = (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard className="p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#525252]" />
          <h2 className="text-lg font-semibold text-[#171717]">{t('tuition.settings.defaults')}</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#737373]">{t('tuition.settings.defaultsDesc')}</p>
      </SectionCard>
      <TuitionTemplateEditor
        template={emailTemplates.reminder}
        saving={saving}
        onSave={template => run(() => onUpdateEmailTemplate('reminder', template))}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {Header}
      {error ? <SectionCard className="border-[#fecaca] bg-[#fef2f2] p-4 text-sm font-medium text-[#b91c1c]">{error}</SectionCard> : null}
      {loading ? <SectionCard className="p-8 text-center text-sm text-[#737373]">{t('tuition.loading')}</SectionCard> : null}
      {activeSection === 'overview' ? stats : null}
      {activeSection === 'overview' ? studentsTable : null}
      {activeSection === 'students' ? studentsTable : null}
      {activeSection === 'payments' ? paymentsPanel : null}
      {activeSection === 'installments' ? plansPanel : null}
      {activeSection === 'reminders' ? remindersPanel : null}
      {activeSection === 'settings' ? settingsPanel : null}

      {planFormOpen ? (
        <TuitionModal title={editingPlan ? t('tuition.modal.editPlan') : t('tuition.modal.newPlan')} onClose={() => { setPlanFormOpen(false); setEditingPlan(null); }}>
          <TuitionPlanForm
            courses={courses}
            saving={saving}
            plan={editingPlan}
            onSubmit={input => run(() => editingPlan
              ? onUpdatePlan(editingPlan.id, {
                  name: input.name,
                  courseId: input.courseId,
                  academicYear: input.academicYear,
                  currency: input.currency,
                  totalAmount: input.totalAmount,
                  status: input.status ?? editingPlan.status,
                })
              : onCreatePlan(input)
            ).then(() => setEditingPlan(null))}
          />
        </TuitionModal>
      ) : null}
      {accountFormOpen ? (
        <TuitionModal title={t('tuition.modal.addStudent')} onClose={() => setAccountFormOpen(false)}>
          <TuitionAccountForm
            students={activeStudents}
            firstYearStudents={activeStudentsByCourseType.firstYear}
            secondYearStudents={activeStudentsByCourseType.secondYear}
            plans={plans}
            saving={saving}
            onOpenStudentDashboard={onOpenStudentDashboard}
            onSubmit={input => run(() => Promise.all(input.studentIds.map(studentId => onEnrollStudent({
              studentId,
              planId: input.planId,
              expectedAmount: input.expectedAmount,
              notes: input.notes,
            }))))}
          />
        </TuitionModal>
      ) : null}
      {paymentFormOpen ? (
        <TuitionModal title={t('tuition.modal.recordPayment')} onClose={() => setPaymentFormOpen(false)}>
          <TuitionPaymentForm rows={accountRows} saving={saving} onSubmit={input => run(() => onRecordPayment(input))} />
        </TuitionModal>
      ) : null}
      {installmentFormOpen ? (
        <TuitionModal title={t('tuition.modal.addInstallment')} onClose={() => setInstallmentFormOpen(false)}>
          <TuitionInstallmentForm plans={plans} saving={saving} onSubmit={input => run(() => onUpsertInstallment(input))} />
        </TuitionModal>
      ) : null}
      {confirmOutstandingOpen ? (
        <TuitionModal title={t('tuition.modal.sendRemindersTitle')} onClose={() => setConfirmOutstandingOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-6 text-[#7c2d12]">
              <p className="font-semibold text-[#9a3412]">
                {tCount('tuition.modal.sendRemindersBody', outstandingAccountIds.length, { count: outstandingAccountIds.length })}
              </p>
              <p className="mt-2">
                {t('tuition.modal.sendRemindersDetail')}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOutstandingOpen(false)}
                className="tbo-focus rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#fafafa]"
              >
                {t('common.cancel')}
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
                {t('tuition.modal.sendReminders')}
              </button>
            </div>
          </div>
        </TuitionModal>
      ) : null}
      {confirmReminderRow ? (
        <TuitionModal title={t('tuition.modal.sendReminderTitle')} onClose={() => setConfirmReminderAccountId(null)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-6 text-[#7c2d12]">
              <p className="font-semibold text-[#9a3412]">
                {t('tuition.modal.sendReminderBody', { name: confirmReminderRow.student?.name ?? t('tuition.form.thisStudent') })}
              </p>
              <p className="mt-2">
                {t('tuition.modal.remainingBalance', { amount: currency(confirmReminderRow.remaining, confirmReminderRow.plan?.currency) })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReminderAccountId(null)}
                className="tbo-focus rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#fafafa]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void run(async () => {
                  await onSendReminder([confirmReminderRow.account.id], null);
                  setConfirmReminderAccountId(null);
                })}
                className="tbo-focus inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {t('tuition.modal.sendReminder')}
              </button>
            </div>
          </div>
        </TuitionModal>
      ) : null}
    </div>
  );
}

const TUITION_TEMPLATE_VARIABLES = [
  'student_name',
  'student_email',
  'remaining_amount',
  'currency',
  'plan_name',
  'installment_title',
  'installment_due_date',
  'installment_line',
  'portal_url',
];

function renderTemplatePreview(template: string) {
  const variables: Record<string, string> = {
    student_name: 'Francis Scott',
    student_email: 'student@example.com',
    remaining_amount: '450.00',
    currency: 'EUR',
    plan_name: 'Annual tuition',
    installment_title: 'Second installment',
    installment_due_date: '31/10/2026',
    installment_line: 'Installment: Second installment\nDue: 31/10/2026',
    portal_url: 'https://portal.example.com',
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function TuitionTemplateEditor({
  template,
  saving,
  onSave,
}: {
  template: TuitionEmailTemplate;
  saving: boolean;
  onSave: (template: TuitionEmailTemplate) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(template);

  useEffect(() => {
    setDraft(template);
  }, [template]);

  const resetToDefault = () => setDraft(DEFAULT_TUITION_EMAIL_TEMPLATES.reminder);

  return (
    <SectionCard className="overflow-hidden xl:col-span-2">
      <div className="border-b border-[#e5e5e5] bg-[#fafafa] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
              <Bell className="h-3.5 w-3.5" />
              {t('tuition.settings.emailTemplates')}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#171717]">{t('tuition.settings.reminderTemplate')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#737373]">{t('tuition.settings.reminderTemplateDesc')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetToDefault}
              className="tbo-focus inline-flex items-center gap-2 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
            >
              <RotateCcw className="h-4 w-4" />
              {t('tuition.settings.resetTemplate')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(draft)}
              className="tbo-focus inline-flex items-center gap-2 rounded-xl bg-[#171717] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? t('common.saving') : t('tuition.settings.saveTemplate')}
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
            {t('tuition.settings.subject')}
            <input
              value={draft.subject}
              onChange={event => setDraft(prev => ({ ...prev, subject: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal normal-case tracking-normal text-[#171717] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
            {t('tuition.settings.emailHeading')}
            <input
              value={draft.title}
              onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal normal-case tracking-normal text-[#171717] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
            {t('tuition.settings.body')}
            <textarea
              value={draft.body}
              onChange={event => setDraft(prev => ({ ...prev, body: event.target.value }))}
              rows={10}
              className="mt-1 w-full resize-y rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#171717] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('tuition.settings.variables')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TUITION_TEMPLATE_VARIABLES.map(variable => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, body: `${prev.body}${prev.body.endsWith('\n') || prev.body.length === 0 ? '' : '\n'}{{${variable}}}` }))}
                  className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5] hover:bg-[#eff6ff] hover:text-[#1d4ed8]"
                  title={t('tuition.settings.insertVariable')}
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <aside className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4 text-sm text-[#1e3a8a]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">{t('tuition.settings.preview')}</p>
          <div className="mt-3 rounded-2xl bg-white p-4 text-[#171717] shadow-sm ring-1 ring-[#bfdbfe]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{renderTemplatePreview(draft.subject)}</p>
            <h3 className="mt-3 text-xl font-semibold">{renderTemplatePreview(draft.title)}</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#525252]">{renderTemplatePreview(draft.body)}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#1d4ed8]">{t('tuition.settings.previewHint')}</p>
        </aside>
      </div>
    </SectionCard>
  );
}

function TuitionModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t('common.close')} />
      <section className="relative w-full max-w-xl rounded-t-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:rounded-2xl">
        <h3 className="text-lg font-semibold text-[#171717]">{title}</h3>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

function TuitionPlanForm({
  courses,
  saving,
  plan,
  onSubmit,
}: {
  courses: Course[];
  saving: boolean;
  plan?: TuitionPlan | null;
  onSubmit: (input: {
    name: string;
    courseId?: number | null;
    academicYear?: string | null;
    currency: string;
    totalAmount: number;
    status?: TuitionPlan['status'];
    firstDueDate?: string;
    secondDueDate?: string;
  }) => void;
}) {
  const { t } = useLanguage();
  const isEditing = !!plan;
  const [name, setName] = useState(() => plan?.name ?? t('tuition.form.defaultPlanName'));
  const [courseId, setCourseId] = useState(() => plan?.courseId ? String(plan.courseId) : '');
  const [amount, setAmount] = useState(() => plan ? String(plan.totalAmount) : '0');
  const [status, setStatus] = useState<TuitionPlan['status']>(() => plan?.status ?? 'active');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [secondDueDate, setSecondDueDate] = useState('');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ name, courseId: courseId ? Number(courseId) : null, currency: plan?.currency ?? 'EUR', totalAmount: Number(amount), status, firstDueDate, secondDueDate }); }}>
      <input value={name} onChange={event => setName(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" placeholder={t('tuition.form.planName')} required />
      <select value={courseId} onChange={event => setCourseId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm">
        <option value="">{t('tuition.form.allActiveStudents')}</option>
        {courses.filter(course => course.status === 'active' || course.id === plan?.courseId).map(course => <option key={course.id} value={course.id}>{course.courseType === 'first_year' ? t('common.yearGroup.first') : t('common.yearGroup.second')} {course.graduationYear}</option>)}
      </select>
      <label className="block text-xs font-semibold text-[#737373]">
        {t('tuition.form.totalAmount')}
        <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
          <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
          <input
            value={amount}
            onChange={event => setAmount(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none"
            placeholder={t('tuition.form.totalPlaceholder')}
            required
          />
        </div>
      </label>
      {isEditing ? (
        <label className="block text-xs font-semibold text-[#737373]">
          {t('common.status')}
          <select value={status} onChange={event => setStatus(event.target.value as TuitionPlan['status'])} className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]">
            <option value="draft">{t('tuition.planStatus.draft')}</option>
            <option value="active">{t('tuition.planStatus.active')}</option>
            <option value="archived">{t('tuition.planStatus.archived')}</option>
          </select>
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#737373]">{t('tuition.form.firstInstallment')}<input value={firstDueDate} onChange={event => setFirstDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" /></label>
          <label className="text-xs font-semibold text-[#737373]">{t('tuition.form.secondInstallment')}<input value={secondDueDate} onChange={event => setSecondDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" /></label>
        </div>
      )}
      {isEditing ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#737373]">
          {t('tuition.form.editPlanHint')}
        </p>
      ) : null}
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isEditing ? t('tuition.form.savePlan') : t('tuition.form.createPlan')}</button>
    </form>
  );
}

function TuitionAccountForm({
  students,
  firstYearStudents,
  secondYearStudents,
  plans,
  saving,
  onOpenStudentDashboard,
  onSubmit,
}: {
  students: User[];
  firstYearStudents: User[];
  secondYearStudents: User[];
  plans: TuitionPlan[];
  saving: boolean;
  onOpenStudentDashboard?: (studentId: string) => void;
  onSubmit: (input: { studentIds: string[]; planId: number; expectedAmount?: number; notes?: string }) => void;
}) {
  const { t, tCount } = useLanguage();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Array<'first_year' | 'second_year'>>([]);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [notes, setNotes] = useState('');
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
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ studentIds: effectiveSelectedStudentIds, planId: Number(planId), expectedAmount: plan?.totalAmount, notes }); }}>
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('tuition.form.studentsLabel')}</p>
        <button
          type="button"
          onClick={() => setStudentPickerOpen(open => !open)}
          className="tbo-focus mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm"
        >
          <span className={effectiveSelectedStudentIds.length > 0 ? 'font-semibold text-[#171717]' : 'text-[#737373]'}>
            {effectiveSelectedStudentIds.length > 0
              ? tCount('tuition.form.selected', effectiveSelectedStudentIds.length, { count: effectiveSelectedStudentIds.length })
              : t('tuition.form.chooseGroupsOrStudents')}
          </span>
          <span className="text-xs font-semibold text-[#737373]">{studentPickerOpen ? t('common.close') : t('common.open')}</span>
        </button>
        {studentPickerOpen ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white p-2 shadow-[0_18px_50px_rgba(23,23,23,0.16)]">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: 'first_year' as const, label: t('common.yearGroup.first'), count: firstYearStudents.length },
                { id: 'second_year' as const, label: t('common.yearGroup.second'), count: secondYearStudents.length },
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
                      <span className="text-xs text-[#737373]">{tCount('tuition.form.studentsInGroup', group.count, { count: group.count })}</span>
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
                    <button
                      type="button"
                      onClick={() => onOpenStudentDashboard?.(student.id)}
                      className="tbo-focus block truncate text-left font-semibold hover:text-[#1d4ed8] hover:underline"
                    >
                      {student.name}
                    </button>
                    <span className="block truncate text-xs text-[#737373]">{student.email}</span>
                  </span>
                </button>
              );
            })}
            {visibleIndividualStudents.length === 0 ? (
              <p className="rounded-xl bg-[#fafafa] px-3 py-4 text-center text-sm text-[#737373]">
                {t('tuition.form.individualHidden')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {effectiveSelectedStudentIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#fafafa] p-2 ring-1 ring-[#eeeeee]">
          {selectedGroups.includes('first_year') ? <button type="button" onClick={() => toggleGroup('first_year')} className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">{t('common.yearGroup.first')} x</button> : null}
          {selectedGroups.includes('second_year') ? <button type="button" onClick={() => toggleGroup('second_year')} className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">{t('common.yearGroup.second')} x</button> : null}
          {selectedStudentIds.slice(0, 8).map(id => {
            const student = students.find(item => item.id === id);
            return (
              <button key={id} type="button" onClick={() => toggleStudent(id)} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                {student?.name ?? t('tuition.form.studentFallback')} x
              </button>
            );
          })}
          {effectiveSelectedStudentIds.length > selectedStudentIds.slice(0, 8).length + selectedGroups.length ? <span className="rounded-full bg-[#171717] px-2.5 py-1 text-xs font-semibold text-white">{t('tuition.form.total', { count: effectiveSelectedStudentIds.length })}</span> : null}
        </div>
      ) : null}
      <select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">{t('tuition.form.choosePlan')}</option>
        {plans.map(planItem => <option key={planItem.id} value={planItem.id}>{planItem.name} - {currency(planItem.totalAmount, planItem.currency)}</option>)}
      </select>
      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
        {t('tuition.form.accountNotes')}
        <textarea
          value={notes}
          onChange={event => setNotes(event.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#171717] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          placeholder={t('tuition.form.accountNotesPlaceholder')}
        />
      </label>
      <button disabled={saving || !plans.length || effectiveSelectedStudentIds.length === 0} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {tCount('tuition.form.addAccounts', effectiveSelectedStudentIds.length || 1, { count: effectiveSelectedStudentIds.length })}
      </button>
    </form>
  );
}
function TuitionPaymentForm({ rows, saving, onSubmit }: { rows: Array<{ account: StudentTuitionAccount; student: User | null; remaining: number; plan: TuitionPlan | null }>; saving: boolean; onSubmit: (input: { accountId: number; amount: number; paymentDate: string; method: string; reference?: string; note?: string }) => void }) {
  const { t } = useLanguage();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayKey());
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ accountId: Number(accountId), amount: Number(amount), paymentDate, method, note }); }}>
      <select value={accountId} onChange={event => { setAccountId(event.target.value); const row = rows.find(item => item.account.id === Number(event.target.value)); setAmount(row?.remaining ? String(row.remaining) : ''); }} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">{t('tuition.form.chooseAccount')}</option>
        {rows.map(row => <option key={row.account.id} value={row.account.id}>{row.student?.name ?? t('common.unknown')} · {t('tuition.form.remainingAmount', { amount: currency(row.remaining, row.plan?.currency) })}</option>)}
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#737373]">
          {t('tuition.form.paymentAmount')}
          <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
            <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none" placeholder={t('tuition.form.amountReceived')} required />
          </div>
        </label>
        <label className="block text-xs font-semibold text-[#737373]">
          {t('tuition.form.paymentDate')}
          <input value={paymentDate} onChange={event => setPaymentDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" required />
        </label>
      </div>
      <select value={method} onChange={event => setMethod(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm">
        <option value="cash">{t('tuition.form.method.cash')}</option>
        <option value="bank_transfer">{t('tuition.form.method.bankTransfer')}</option>
        <option value="card">{t('tuition.form.method.card')}</option>
        <option value="other">{t('tuition.form.method.other')}</option>
      </select>
      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
        {t('tuition.form.paymentNote')}
        <textarea
          value={note}
          onChange={event => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#171717] outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          placeholder={t('tuition.form.paymentNotePlaceholder')}
        />
      </label>
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t('tuition.form.savePayment')}</button>
    </form>
  );
}

function TuitionInstallmentForm({ plans, saving, onSubmit }: { plans: TuitionPlan[]; saving: boolean; onSubmit: (input: { planId: number; title: string; amount: number; dueDate: string }) => void }) {
  const { t } = useLanguage();
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); onSubmit({ planId: Number(planId), title, amount: Number(amount), dueDate }); }}>
      <select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" required>
        <option value="">{t('tuition.form.choosePlan')}</option>
        {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <input value={title} onChange={event => setTitle(event.target.value)} className="h-10 rounded-xl border border-[#d4d4d4] px-3 text-sm" placeholder={t('tuition.form.installmentTitle')} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#737373]">
          {t('tuition.form.installmentAmount')}
          <div className="mt-1 flex h-10 overflow-hidden rounded-xl border border-[#d4d4d4] bg-white focus-within:ring-2 focus-within:ring-[#bfdbfe]">
            <span className="grid w-14 place-items-center border-r border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#525252]">EUR</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 px-3 text-sm font-normal text-[#171717] outline-none" placeholder={t('tuition.form.amountDue')} required />
          </div>
        </label>
        <label className="block text-xs font-semibold text-[#737373]">
          {t('tuition.form.dueDate')}
          <input value={dueDate} onChange={event => setDueDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-[#d4d4d4] px-3 text-sm font-normal text-[#171717]" required />
        </label>
      </div>
      <button disabled={saving} className="mt-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t('tuition.form.saveInstallment')}</button>
    </form>
  );
}
