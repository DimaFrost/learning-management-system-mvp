import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types/lms';
import { formatPlatformDate, formatPlatformDateTime } from '../../utils/dateUtils';

type DeliveryStatus = 'all' | 'sent' | 'failed' | 'pending' | 'skipped';
type JobStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';
type EmailType = 'all' | string;

type NotificationJob = {
  id: number;
  type: string;
  status: string;
  scheduled_for: string | null;
  processed_at: string | null;
  attempts: number | null;
  max_attempts: number | null;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

type EmailLogRow = {
  id: number;
  job_id: number;
  recipient_id: string | null;
  recipient_email: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  job: NotificationJob | null;
};

const PAGE_SIZE = 30;

const TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  workflow_email: 'emailLog.type.portalUpdate',
  announcement_email: 'emailLog.type.stream',
  todo_reminder_email: 'emailLog.type.todo',
  absence_notice_email: 'emailLog.type.absenceNotice',
  direct_message_email: 'emailLog.type.message',
  role_change_email: 'emailLog.type.access',
  enrollment_email: 'emailLog.type.enrollment',
  profile_invite_email: 'emailLog.type.access',
  tuition_reminder_email: 'emailLog.type.tuition',
};

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  sent: 'emailLog.status.sent',
  failed: 'emailLog.status.failed',
  pending: 'emailLog.status.pending',
  skipped: 'emailLog.status.skipped',
  processing: 'emailLog.status.processing',
  completed: 'emailLog.status.completed',
  canceled: 'emailLog.status.canceled',
};

function getPayloadText(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return '';
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function titleFrom(row: EmailLogRow, typeLabel: (type: string) => string) {
  return getPayloadText(row.job?.payload, ['subject', 'title']) || typeLabel(row.job?.type ?? 'portal_email');
}

function bodyFrom(row: EmailLogRow) {
  return getPayloadText(row.job?.payload, ['body', 'content', 'reason', 'preview', 'message']);
}

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.includes('@')
    ? nameOrEmail.split('@')[0].split(/[._-]/)
    : nameOrEmail.split(/\s+/);
  return parts
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function statusTone(status: string) {
  if (status === 'sent' || status === 'completed') return 'border-[#cdebd8] bg-[#f0fbf4] text-[#137333]';
  if (status === 'failed') return 'border-[#f4c7c3] bg-[#fff4f2] text-[#b42318]';
  if (status === 'skipped' || status === 'canceled') return 'border-[#e5e5e5] bg-[#f7f7f7] text-[#525252]';
  return 'border-[#f2dfaa] bg-[#fff8e6] text-[#9a5b00]';
}

function typeTone(type: string | undefined) {
  if (type === 'announcement_email') return 'bg-[#e7f7ee] text-[#137333]';
  if (type === 'tuition_reminder_email') return 'bg-[#fff2dc] text-[#9a5b00]';
  if (type === 'absence_notice_email') return 'bg-[#fef7e0] text-[#8a5a00]';
  if (type === 'todo_reminder_email' || type === 'workflow_email') return 'bg-[#e8f0fe] text-[#1a73e8]';
  return 'bg-[#f3f4f6] text-[#525252]';
}

export function EmailLogView({ users }: { users: User[] }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [selected, setSelected] = useState<EmailLogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('all');
  const [jobStatus, setJobStatus] = useState<JobStatus>('all');
  const [emailType, setEmailType] = useState<EmailType>('all');
  const [recipientId, setRecipientId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const getTypeLabel = useCallback((type: string) => {
    const key = TYPE_LABEL_KEYS[type];
    if (key) return t(key);
    return type.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }, [t]);

  const getStatusLabel = useCallback((status: string) => {
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
  }, [t]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let request = supabase
        .from('notification_deliveries')
        .select(`
          id,
          job_id,
          recipient_id,
          recipient_email,
          status,
          provider,
          provider_message_id,
          error_message,
          sent_at,
          created_at,
          job:notification_jobs!inner(
            id,
            type,
            status,
            scheduled_for,
            processed_at,
            attempts,
            max_attempts,
            payload,
            error_message,
            created_at
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (deliveryStatus !== 'all') request = request.eq('status', deliveryStatus);
      if (jobStatus !== 'all') request = request.eq('job.status', jobStatus);
      if (emailType !== 'all') request = request.eq('job.type', emailType);
      if (recipientId !== 'all') request = request.eq('recipient_id', recipientId);
      if (fromDate) request = request.gte('created_at', `${fromDate}T00:00:00`);
      if (toDate) request = request.lte('created_at', `${toDate}T23:59:59`);
      if (query.trim().includes('@')) request = request.ilike('recipient_email', `%${query.trim()}%`);

      const { data, error: fetchError, count } = await request;
      if (fetchError) throw fetchError;

      setRows((data ?? []) as unknown as EmailLogRow[]);
      setTotal(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('emailLog.error.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [deliveryStatus, emailType, fromDate, jobStatus, page, query, recipientId, t, toDate]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPage(0);
  }, [deliveryStatus, emailType, fromDate, jobStatus, query, recipientId, toDate]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || needle.includes('@')) return rows;
    return rows.filter(row => {
      const recipient = row.recipient_id ? usersById.get(row.recipient_id) : null;
      return [
        recipient?.name,
        recipient?.email,
        row.recipient_email,
        titleFrom(row, getTypeLabel),
        bodyFrom(row),
        getTypeLabel(row.job?.type ?? ''),
        row.status,
        row.job?.status,
      ].some(value => String(value ?? '').toLowerCase().includes(needle));
    });
  }, [getTypeLabel, query, rows, usersById]);

  const emailTypes = useMemo(() => {
    const values = new Set(rows.map(row => row.job?.type).filter(Boolean) as string[]);
    Object.keys(TYPE_LABEL_KEYS).forEach(type => values.add(type));
    return Array.from(values).sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b)));
  }, [getTypeLabel, rows]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleSent = filteredRows.filter(row => row.status === 'sent').length;
  const visibleFailed = filteredRows.filter(row => row.status === 'failed').length;
  const activeFilterCount = [
    deliveryStatus !== 'all',
    jobStatus !== 'all',
    emailType !== 'all',
    recipientId !== 'all',
    Boolean(fromDate),
    Boolean(toDate),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setQuery('');
    setDeliveryStatus('all');
    setJobStatus('all');
    setEmailType('all');
    setRecipientId('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="min-h-full bg-[#f8faf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="rounded-[22px] border border-[#e1d9cc] bg-[#fffdfa] px-5 py-4 shadow-[0_18px_55px_rgba(91,70,39,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#e6dfd3] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6a45]">
                <MailCheck className="h-3.5 w-3.5" />
                {t('emailLog.badge')}
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#24201a]">{t('emailLog.title')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#766b5d]">{t('emailLog.desc')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className="rounded-2xl border border-[#e8e0d5] bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8b7a]">{t('emailLog.stats.visible')}</p>
                <p className="mt-1 text-xl font-semibold text-[#26211b]">{filteredRows.length}</p>
              </div>
              <div className="rounded-2xl border border-[#d8eddf] bg-[#f4fbf6] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#568564]">{t('emailLog.stats.sent')}</p>
                <p className="mt-1 text-xl font-semibold text-[#137333]">{visibleSent}</p>
              </div>
              <div className="rounded-2xl border border-[#f1d0ca] bg-[#fff7f5] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ad6b60]">{t('emailLog.stats.failed')}</p>
                <p className="mt-1 text-xl font-semibold text-[#b42318]">{visibleFailed}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[22px] border border-[#e1d9cc] bg-[#fffdfa] p-3 shadow-[0_18px_55px_rgba(91,70,39,0.05)]">
          <div className="relative">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8b7a]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('emailLog.search.placeholder')}
                className="h-11 w-full rounded-xl border border-[#e1d9cc] bg-white pl-9 pr-36 text-sm outline-none transition focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(open => !open)}
              className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-2 rounded-lg border border-[#e6ded2] bg-[#fbf7f0] px-2.5 text-xs font-semibold text-[#655748] transition hover:border-[#c7a980] hover:bg-[#f5ecdf]"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{t('emailLog.filter.filters')}</span>
              {activeFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#29231d] px-1.5 text-[10px] text-white">{activeFilterCount}</span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-3 grid gap-2 border-t border-[#eee6dc] pt-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <select value={recipientId} onChange={event => setRecipientId(event.target.value)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]">
                  <option value="all">{t('emailLog.filter.allRecipients')}</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                  ))}
                </select>
                <select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value as DeliveryStatus)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]">
                  <option value="all">{t('emailLog.filter.allDelivery')}</option>
                  {(['sent', 'failed', 'pending', 'skipped'] as const).map(status => (
                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                  ))}
                </select>
                <select value={jobStatus} onChange={event => setJobStatus(event.target.value as JobStatus)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]">
                  <option value="all">{t('emailLog.filter.allJobs')}</option>
                  {(['pending', 'processing', 'completed', 'failed', 'canceled'] as const).map(status => (
                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                  ))}
                </select>
                <select value={emailType} onChange={event => setEmailType(event.target.value)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]">
                  <option value="all">{t('emailLog.filter.allTypes')}</option>
                  {emailTypes.map(type => (
                    <option key={type} value={type}>{getTypeLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto]">
                <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]" aria-label={t('emailLog.filter.from')} />
                <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm text-[#3a3229] outline-none focus:border-[#c7a980] focus:ring-2 focus:ring-[#eadcc8]" aria-label={t('emailLog.filter.to')} />
                <button type="button" onClick={clearFilters} className="h-10 rounded-xl border border-[#e1d9cc] bg-white px-4 text-sm font-semibold text-[#5f5448] transition hover:border-[#c7a980] hover:bg-[#fbf7f0]">
                  {t('emailLog.filter.clear')}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#e1d9cc] bg-[#fffdfa] shadow-[0_18px_55px_rgba(91,70,39,0.06)]">
          <div className="flex items-center justify-between border-b border-[#ebe4da] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-[#2f2922]">{t('emailLog.table.title')}</h2>
              <p className="text-xs text-[#8a7b6a]">{t('emailLog.table.pageOf', { page: page + 1, total: pageCount })}</p>
            </div>
            <button type="button" onClick={() => void loadRows()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm font-semibold text-[#5f5448] transition hover:border-[#c7a980] hover:bg-[#fbf7f0]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('emailLog.refresh')}
            </button>
          </div>

          {error && (
            <div className="m-4 flex items-center gap-2 rounded-2xl border border-[#f4c7c3] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eee6dc] text-left text-sm">
              <thead className="bg-[#fbf7f0] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7b6a]">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t('emailLog.table.date')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('emailLog.table.recipient')}</th>
                  <th className="min-w-[260px] px-4 py-3">{t('emailLog.table.subject')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('emailLog.table.type')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('emailLog.table.delivery')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('emailLog.table.job')}</th>
                  <th className="px-4 py-3 text-right">{t('emailLog.table.open')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8dd] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#766b5d]">{t('emailLog.loading')}</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#766b5d]">{t('emailLog.empty')}</td>
                  </tr>
                ) : filteredRows.map(row => {
                  const recipient = row.recipient_id ? usersById.get(row.recipient_id) : null;
                  const title = titleFrom(row, getTypeLabel);
                  return (
                    <tr key={row.id} onClick={() => setSelected(row)} className="cursor-pointer transition hover:bg-[#fffaf2]">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[#6f6255]">
                        <div className="font-semibold text-[#302820]">{formatPlatformDate(row.sent_at ?? row.created_at)}</div>
                        <div>{formatPlatformDateTime(row.sent_at ?? row.created_at)?.split(',').pop()?.trim() ?? '-'}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-[220px] items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2eee8] text-xs font-semibold text-[#6d5d4d]">
                            {initials(recipient?.name ?? row.recipient_email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#2d271f]">{recipient?.name ?? row.recipient_email}</p>
                            <p className="truncate text-xs text-[#8a7b6a]">{recipient?.email ?? row.recipient_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="line-clamp-1 font-medium text-[#2d271f]">{title}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeTone(row.job?.type)}`}>{getTypeLabel(row.job?.type ?? 'portal_email')}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                          {row.status === 'sent' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                          {getStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-[#6f6255]">{getStatusLabel(row.job?.status ?? '-')}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e1d9cc] bg-white text-[#675c50] transition hover:border-[#c7a980] hover:bg-[#fbf7f0]" aria-label={t('emailLog.table.open')}>
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#ebe4da] bg-[#fffdfa] px-4 py-3">
            <p className="text-xs text-[#8a7b6a]">{t('emailLog.table.total', { total })}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0} className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm font-semibold text-[#5f5448] transition hover:bg-[#fbf7f0] disabled:cursor-not-allowed disabled:opacity-45">
                <ChevronLeft className="h-4 w-4" />
                {t('emailLog.prev')}
              </button>
              <button type="button" onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1} className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e1d9cc] bg-white px-3 text-sm font-semibold text-[#5f5448] transition hover:bg-[#fbf7f0] disabled:cursor-not-allowed disabled:opacity-45">
                {t('emailLog.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-[#e1d9cc] bg-[#fffdfa] shadow-[0_30px_90px_rgba(38,28,15,0.24)]" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#ebe4da] px-5 py-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#f4efe6] px-3 py-1 text-xs font-semibold text-[#745d43]">
                  <Send className="h-3.5 w-3.5" />
                  {getTypeLabel(selected.job?.type ?? 'portal_email')}
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#27211a]">{titleFrom(selected, getTypeLabel)}</h2>
                <p className="mt-1 text-sm text-[#766b5d]">
                  {t('emailLog.modal.sentTo', {
                    email: usersById.get(selected.recipient_id ?? '')?.email ?? selected.recipient_email,
                    date: formatPlatformDateTime(selected.sent_at ?? selected.created_at) ?? '-',
                  })}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e1d9cc] bg-white text-[#675c50] transition hover:border-[#c7a980] hover:bg-[#fbf7f0]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-96px)] overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [t('emailLog.table.recipient'), usersById.get(selected.recipient_id ?? '')?.name ?? selected.recipient_email],
                  [t('emailLog.modal.recipientEmail'), usersById.get(selected.recipient_id ?? '')?.email ?? selected.recipient_email],
                  [t('emailLog.table.delivery'), getStatusLabel(selected.status)],
                  [t('emailLog.table.job'), getStatusLabel(selected.job?.status ?? '-')],
                  [t('emailLog.detail.scheduled'), formatPlatformDateTime(selected.job?.scheduled_for) ?? '-'],
                  [t('emailLog.detail.processed'), formatPlatformDateTime(selected.job?.processed_at) ?? '-'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-[#eee5da] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8b7a]">{label}</p>
                    <p className="mt-1 break-words text-sm font-medium text-[#2f2922]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[#eee5da] bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8b7a]">{t('emailLog.modal.content')}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#40372e]">{bodyFrom(selected) || t('emailLog.modal.noContent')}</p>
              </div>

              {(selected.error_message || selected.job?.error_message) && (
                <div className="mt-4 rounded-2xl border border-[#f4c7c3] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">
                  <p className="font-semibold">{t('emailLog.modal.error')}</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.error_message || selected.job?.error_message}</p>
                </div>
              )}

              <details className="mt-4 rounded-2xl border border-[#eee5da] bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#3a3229]">{t('emailLog.modal.payload')}</summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-[#1f1f1f] p-3 text-xs leading-5 text-[#f8f5ee]">
                  {JSON.stringify(selected.job?.payload ?? {}, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
