import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types/lms';
import { formatPlatformDateTime } from '../../utils/dateUtils';

type DeliveryStatus = 'all' | 'sent' | 'failed' | 'pending' | 'skipped';

type NotificationJob = {
  id: number;
  type: string;
  status: string;
  scheduled_for: string;
  processed_at: string | null;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

type InboxMessage = {
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

const PAGE_SIZE = 10;

function getPayloadText(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return '';
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getMessageTitle(message: InboxMessage) {
  return getPayloadText(message.job?.payload, ['subject', 'title']) || getTypeLabel(message.job?.type ?? 'portal_email');
}

function getMessageBody(message: InboxMessage) {
  return getPayloadText(message.job?.payload, ['body', 'content', 'reason']);
}

function getTypeLabel(type: string) {
  if (type === 'workflow_email') return 'Portal update';
  if (type === 'announcement_email') return 'Stream';
  if (type === 'todo_reminder_email') return 'To-do';
  if (type === 'absence_notice_email') return 'Absence notice';
  return type.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getMessageTone(type: string | undefined) {
  if (type === 'announcement_email') return {
    icon: Bell,
    badge: 'bg-[#e7f7ee] text-[#137333] border-[#cdebd8]',
    circle: 'bg-[#e7f7ee] text-[#137333]',
    rail: 'bg-[#137333]',
  };
  if (type === 'absence_notice_email') return {
    icon: CalendarCheck,
    badge: 'bg-[#fff8e6] text-[#9a5b00] border-[#f2dfaa]',
    circle: 'bg-[#fff8e6] text-[#9a5b00]',
    rail: 'bg-[#d99000]',
  };
  if (type === 'todo_reminder_email' || type === 'workflow_email') return {
    icon: BookOpen,
    badge: 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]',
    circle: 'bg-[#e8f0fe] text-[#1a73e8]',
    rail: 'bg-[#1a73e8]',
  };
  return {
    icon: Mail,
    badge: 'bg-[#f3f4f6] text-[#525252] border-[#e5e5e5]',
    circle: 'bg-[#f3f4f6] text-[#525252]',
    rail: 'bg-[#737373]',
  };
}

function getStatusTone(status: string) {
  if (status === 'sent') return 'text-[#137333]';
  if (status === 'failed') return 'text-[#b42318]';
  return 'text-[#9a5b00]';
}

function getStatusLabel(status: string) {
  if (status === 'sent') return 'Delivered';
  if (status === 'failed') return 'Failed';
  if (status === 'pending') return 'Pending';
  if (status === 'skipped') return 'Skipped';
  return status;
}

export function InboxView({ currentUser }: { currentUser: User }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DeliveryStatus>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const loadMessages = useCallback(async () => {
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
            payload,
            error_message,
            created_at
          )
        `, { count: 'exact' })
        .or(`recipient_id.eq.${currentUser.id},recipient_email.eq.${currentUser.email}`)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (status !== 'all') request = request.eq('status', status);

      const { data, error: fetchError, count } = await request;
      if (fetchError) throw fetchError;

      const rows = ((data ?? []) as unknown as InboxMessage[]).filter(message => {
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          getMessageTitle(message).toLowerCase().includes(needle) ||
          getMessageBody(message).toLowerCase().includes(needle) ||
          getTypeLabel(message.job?.type ?? '').toLowerCase().includes(needle)
        );
      });

      setMessages(rows);
      setTotal(count ?? rows.length);
      setSelected(current => {
        if (current && rows.some(row => row.id === current.id)) return current;
        return rows[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inbox.');
      setMessages([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, page, query, status]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setPage(0);
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedTone = getMessageTone(selected?.job?.type);
  const SelectedIcon = selectedTone.icon;
  const visibleSentCount = messages.filter(message => message.status === 'sent').length;

  return (
    <div className="min-h-full bg-[#f8faf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-[24px] border border-[#e1d9cc] bg-[#fffdfa] p-5 shadow-[0_18px_55px_rgba(91,70,39,0.07)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd3] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6a45]">
                <Inbox className="h-3.5 w-3.5" />
                Admin emails
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#171717]">Inbox</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#6b6257]">
                Copies of portal emails sent to your admin account, so important notices are still visible inside the platform.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-[300px]">
              <div className="rounded-2xl border border-[#e6dfd3] bg-white px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a8175]">This page</p>
                <p className="mt-1 text-xl font-semibold text-[#171717]">{messages.length}</p>
              </div>
              <div className="rounded-2xl border border-[#cdebd8] bg-[#f1fbf5] px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#4f8663]">Delivered</p>
                <p className="mt-1 text-xl font-semibold text-[#137333]">{visibleSentCount}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9287]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search subject or email"
                className="tbo-focus h-11 w-full rounded-2xl border border-[#ded8cc] bg-white pl-9 pr-3 text-sm text-[#171717] outline-none"
              />
            </label>
            <select
              value={status}
              onChange={event => setStatus(event.target.value as DeliveryStatus)}
              className="tbo-focus h-11 rounded-2xl border border-[#ded8cc] bg-white px-3 text-sm text-[#3f3a34]"
            >
              <option value="all">All emails</option>
              <option value="sent">Delivered</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="skipped">Skipped</option>
            </select>
            <button
              type="button"
              onClick={() => loadMessages()}
              className="tbo-focus inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#ded8cc] bg-white px-4 text-sm font-semibold text-[#3f3a34] transition-colors hover:bg-[#f7f2ea]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="grid min-h-[560px] overflow-hidden rounded-[24px] border border-[#e1d9cc] bg-white shadow-[0_18px_55px_rgba(91,70,39,0.07)] lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col border-b border-[#eee7dc] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-[#eee7dc] bg-[#fffdfa] px-4 py-3">
              <p className="text-sm font-semibold text-[#171717]">Emails sent to you</p>
              <p className="text-xs text-[#7b7167]">Page {page + 1} of {pageCount}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error && <div className="border-b border-[#f5c7c0] bg-[#fff6f4] px-4 py-3 text-sm text-[#b42318]">{error}</div>}
              {loading ? (
                <div className="p-8 text-center text-sm text-[#6b6257]">Loading inbox...</div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f0e8] text-[#8a6a45]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#171717]">No emails here</p>
                  <p className="mt-1 text-sm text-[#6b6257]">Portal email copies sent to you will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#eee7dc]">
                  {messages.map(message => {
                    const tone = getMessageTone(message.job?.type);
                    const Icon = tone.icon;
                    const active = selected?.id === message.id;
                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => setSelected(message)}
                        className={`tbo-focus group grid w-full grid-cols-[4px_minmax(0,1fr)] text-left transition-colors ${
                          active ? 'bg-[#fff8e6]' : 'bg-white hover:bg-[#fffaf2]'
                        }`}
                      >
                        <span className={active ? tone.rail : 'bg-transparent'} />
                        <span className="min-w-0 px-4 py-3">
                          <span className="flex min-w-0 items-start gap-3">
                            <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl ${tone.circle}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-semibold text-[#171717]">{getMessageTitle(message)}</span>
                                <span className="flex-shrink-0 text-[11px] text-[#8a8175]">
                                  {formatPlatformDateTime(message.sent_at ?? message.created_at)}
                                </span>
                              </span>
                              <span className="mt-1 flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
                                  {getTypeLabel(message.job?.type ?? 'portal_email')}
                                </span>
                                <span className={`text-[11px] font-medium ${getStatusTone(message.status)}`}>
                                  {getStatusLabel(message.status)}
                                </span>
                              </span>
                              {getMessageBody(message) && (
                                <span className="mt-2 block truncate text-xs leading-5 text-[#7b7167]">
                                  {getMessageBody(message)}
                                </span>
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[#eee7dc] bg-[#fffdfa] px-4 py-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(value => Math.max(0, value - 1))}
                className="tbo-focus inline-flex h-9 items-center gap-2 rounded-xl border border-[#ded8cc] bg-white px-3 text-xs font-semibold text-[#3f3a34] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage(value => value + 1)}
                className="tbo-focus inline-flex h-9 items-center gap-2 rounded-xl border border-[#ded8cc] bg-white px-3 text-xs font-semibold text-[#3f3a34] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="min-h-0 bg-[#fffdfa]">
            {selected ? (
              <article className="flex h-full min-h-[520px] flex-col">
                <div className="border-b border-[#eee7dc] bg-white px-6 py-5">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] ${selectedTone.circle}`}>
                      <SelectedIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedTone.badge}`}>
                          {getTypeLabel(selected.job?.type ?? 'portal_email')}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${getStatusTone(selected.status)}`}>
                          {selected.status === 'sent' ? <CheckCircle2 className="h-3.5 w-3.5" /> : selected.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                          {getStatusLabel(selected.status)}
                        </span>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight text-[#171717]">{getMessageTitle(selected)}</h2>
                      <p className="mt-1 text-sm text-[#7b7167]">
                        Sent to {selected.recipient_email} · {formatPlatformDateTime(selected.sent_at ?? selected.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  <div className="mx-auto max-w-3xl rounded-[22px] border border-[#e6dfd3] bg-white p-6 shadow-[0_14px_40px_rgba(91,70,39,0.06)]">
                    {getMessageBody(selected) ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[#3f3a34]">{getMessageBody(selected)}</p>
                    ) : (
                      <p className="text-sm text-[#7b7167]">No message body was stored for this email.</p>
                    )}
                    {selected.error_message && (
                      <div className="mt-5 rounded-2xl border border-[#f5c7c0] bg-[#fff6f4] p-4 text-sm text-[#b42318]">
                        {selected.error_message}
                      </div>
                    )}
                  </div>
                  <div className="mx-auto mt-4 max-w-3xl rounded-[18px] border border-[#e6dfd3] bg-[#f8f5ef] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8175]">Delivery details</p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <Detail label="Provider" value={selected.provider} />
                      <Detail label="Provider ID" value={selected.provider_message_id ?? '-'} />
                      <Detail label="Job status" value={selected.job?.status ?? '-'} />
                      <Detail label="Processed" value={formatPlatformDateTime(selected.job?.processed_at) || '-'} />
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f5f0e8] text-[#8a6a45]">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#171717]">Choose an email</p>
                <p className="mt-1 max-w-sm text-sm text-[#6b6257]">
                  Select a portal email copy from the list to read its content and delivery details.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8a8175]">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-[#171717]">{value}</p>
    </div>
  );
}
