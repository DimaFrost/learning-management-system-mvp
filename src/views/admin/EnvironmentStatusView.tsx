import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cloud,
  Database,
  FileCheck2,
  HardDrive,
  HelpCircle,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useLanguage, type TranslationKey } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types/lms';
import { getGoogleDocsConnectionStatus, testGoogleDocsSetup } from '../../utils/googleDocsV2';
import { formatPlatformDateTime } from '../../utils/dateUtils';

type CheckStatus = 'checking' | 'connected' | 'warning' | 'disconnected';
type CheckGroup = 'app' | 'supabase' | 'google' | 'notifications' | 'storage';

type EnvironmentCheck = {
  id: string;
  group: CheckGroup;
  title: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  inferred?: boolean;
};

type NotificationJobRow = {
  id: number;
  status: string;
  scheduled_for: string | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

const GROUP_ORDER: CheckGroup[] = ['app', 'supabase', 'google', 'notifications', 'storage'];

function getProjectRef(url: string) {
  try {
    return new URL(url).hostname.split('.')[0] || url;
  } catch {
    return url || 'unknown';
  }
}

function statusRank(status: CheckStatus) {
  if (status === 'disconnected') return 3;
  if (status === 'warning') return 2;
  if (status === 'checking') return 1;
  return 0;
}

function statusClasses(status: CheckStatus) {
  if (status === 'connected') return 'border-[#cdebd8] bg-[#f7fcf8] text-[#137333]';
  if (status === 'warning') return 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]';
  if (status === 'disconnected') return 'border-[#f4c7c3] bg-[#fff8f6] text-[#b42318]';
  return 'border-[#d2e3fc] bg-[#f7faff] text-[#1a73e8]';
}

function groupTone(group: CheckGroup) {
  if (group === 'app') return 'bg-[#f7faff] text-[#1a73e8] border-[#d2e3fc]';
  if (group === 'google') return 'bg-[#f7fcf8] text-[#137333] border-[#cdebd8]';
  if (group === 'notifications') return 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]';
  return 'bg-[#fafafa] text-[#525252] border-[#e5e5e5]';
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'connected') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4" />;
  if (status === 'disconnected') return <XCircle className="h-4 w-4" />;
  return <RefreshCw className="h-4 w-4 animate-spin" />;
}

export function EnvironmentStatusView({
  currentUser,
  onNavigate,
}: {
  currentUser: User;
  onNavigate: (view: string) => void;
}) {
  const { t } = useLanguage();
  const [checks, setChecks] = useState<EnvironmentCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '');
  const appEnv = String(import.meta.env.VITE_APP_ENV ?? '');
  const appEnvLabel = String((import.meta.env.VITE_APP_ENV_LABEL ?? appEnv) || 'Unknown');
  const projectRef = getProjectRef(supabaseUrl);

  const runChecks = useCallback(async () => {
    setLoading(true);
    const started = new Date();
    const nextChecks: EnvironmentCheck[] = [];

    const push = (check: EnvironmentCheck) => nextChecks.push(check);

    if (supabaseUrl && appEnvLabel) {
      push({
        id: 'frontend-env',
        group: 'app',
        title: t('environmentStatus.env.title'),
        status: 'connected',
        message: t('environmentStatus.env.connected', { label: appEnvLabel, ref: projectRef }),
        detail: `${t('environmentStatus.url')}: ${supabaseUrl}`,
      });
    } else {
      push({
        id: 'frontend-env',
        group: 'app',
        title: t('environmentStatus.env.title'),
        status: 'warning',
        message: t('environmentStatus.env.warning'),
      });
    }

    push({
      id: 'signed-in-profile',
      group: 'app',
      title: t('environmentStatus.auth.title'),
      status: currentUser?.id ? 'connected' : 'disconnected',
      message: currentUser?.id
        ? t('environmentStatus.auth.connected', { name: currentUser.name || currentUser.email || currentUser.id })
        : t('environmentStatus.auth.disconnected'),
      detail: currentUser?.email ?? currentUser?.id,
    });

    const databaseCheck = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    push({
      id: 'database-api',
      group: 'supabase',
      title: t('environmentStatus.database.title'),
      status: databaseCheck.error ? 'disconnected' : 'connected',
      message: databaseCheck.error
        ? t('environmentStatus.database.disconnected')
        : t('environmentStatus.database.connected'),
      detail: databaseCheck.error?.message ?? `${databaseCheck.count ?? 0} profiles visible`,
    });

    const storageCheck = await supabase.storage.from('tbo-lms').list('', { limit: 1 });
    push({
      id: 'storage-bucket',
      group: 'storage',
      title: t('environmentStatus.storage.title'),
      status: storageCheck.error ? 'warning' : 'connected',
      message: storageCheck.error
        ? t('environmentStatus.storage.warning')
        : t('environmentStatus.storage.connected'),
      detail: storageCheck.error?.message,
    });

    const bookLookup = await supabase.functions.invoke('book-lookup', {
      body: { mode: 'search', query: 'Bible' },
    });
    const bookLookupData = bookLookup.data as { error?: string; results?: unknown[] } | null;
    push({
      id: 'book-lookup',
      group: 'supabase',
      title: t('environmentStatus.bookLookup.title'),
      status: bookLookup.error ? 'disconnected' : bookLookupData?.error ? 'warning' : 'connected',
      message: bookLookup.error
        ? t('environmentStatus.bookLookup.disconnected')
        : bookLookupData?.error
          ? t('environmentStatus.bookLookup.warning')
          : t('environmentStatus.bookLookup.connected'),
      detail: bookLookup.error?.message ?? `${bookLookupData?.results?.length ?? 0} result(s) returned`,
    });

    try {
      const googleStatus = await getGoogleDocsConnectionStatus();
      push({
        id: 'google-docs-status',
        group: 'google',
        title: t('environmentStatus.googleStatus.title'),
        status: googleStatus.connected ? 'connected' : 'warning',
        message: googleStatus.connected && googleStatus.connection
          ? t('environmentStatus.googleStatus.connected', { email: googleStatus.connection.connected_email })
          : t('environmentStatus.googleStatus.warning'),
        detail: googleStatus.connection?.updated_at
          ? t('settings.googleDocs.lastSaved', { datetime: formatPlatformDateTime(googleStatus.connection.updated_at) ?? googleStatus.connection.updated_at })
          : undefined,
      });
    } catch (error) {
      push({
        id: 'google-docs-status',
        group: 'google',
        title: t('environmentStatus.googleStatus.title'),
        status: 'disconnected',
        message: t('environmentStatus.googleStatus.disconnected'),
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const diagnostics = await testGoogleDocsSetup();
      const failed = diagnostics.checks.filter(check => !check.ok);
      push({
        id: 'google-drive-diagnostics',
        group: 'google',
        title: t('environmentStatus.googleDiagnostics.title'),
        status: diagnostics.ok ? 'connected' : 'warning',
        message: diagnostics.ok
          ? t('environmentStatus.googleDiagnostics.connected')
          : t('environmentStatus.googleDiagnostics.warning', { count: failed.length }),
        detail: diagnostics.checks.map(check => `${check.label}: ${check.message}`).join('\n'),
      });
    } catch (error) {
      push({
        id: 'google-drive-diagnostics',
        group: 'google',
        title: t('environmentStatus.googleDiagnostics.title'),
        status: 'disconnected',
        message: t('environmentStatus.googleDiagnostics.disconnected'),
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    const jobsRequest = await supabase
      .from('notification_jobs')
      .select('id, status, scheduled_for, processed_at, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (jobsRequest.error) {
      push({
        id: 'notification-queue',
        group: 'notifications',
        title: t('environmentStatus.notificationQueue.title'),
        status: 'disconnected',
        message: t('environmentStatus.notificationQueue.disconnected'),
        detail: jobsRequest.error.message,
      });
      push({
        id: 'notification-processor',
        group: 'notifications',
        title: t('environmentStatus.notificationProcessor.title'),
        status: 'disconnected',
        message: t('environmentStatus.notificationProcessor.disconnected'),
        inferred: true,
      });
    } else {
      const jobs = (jobsRequest.data ?? []) as NotificationJobRow[];
      const failed = jobs.filter(job => job.status === 'failed').length;
      const pending = jobs.filter(job => job.status === 'pending').length;
      const stalePending = jobs.filter(job => {
        if (job.status !== 'pending') return false;
        const scheduledFor = job.scheduled_for ? new Date(job.scheduled_for).getTime() : new Date(job.created_at).getTime();
        return Number.isFinite(scheduledFor) && scheduledFor < Date.now() - 15 * 60 * 1000;
      }).length;
      const recentCompleted = jobs.some(job => {
        if (job.status !== 'completed' || !job.processed_at) return false;
        return new Date(job.processed_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
      });
      const hasCompleted = jobs.some(job => job.status === 'completed' && job.processed_at);
      const processorIdle = hasCompleted && failed === 0 && stalePending === 0;

      push({
        id: 'notification-queue',
        group: 'notifications',
        title: t('environmentStatus.notificationQueue.title'),
        status: failed > 0 || stalePending > 0 ? 'warning' : 'connected',
        message: failed > 0 || stalePending > 0
          ? t('environmentStatus.notificationQueue.warning', { pending, failed })
          : t('environmentStatus.notificationQueue.connected', { pending, failed }),
        detail: jobs.slice(0, 5).map(job => `#${job.id} ${job.status} ${job.error_message ?? ''}`.trim()).join('\n'),
      });

      push({
        id: 'notification-processor',
        group: 'notifications',
        title: t('environmentStatus.notificationProcessor.title'),
        status: recentCompleted || processorIdle ? 'connected' : 'warning',
        message: recentCompleted
          ? t('environmentStatus.notificationProcessor.connected')
          : processorIdle
            ? t('environmentStatus.notificationProcessor.idle')
          : t('environmentStatus.notificationProcessor.warning'),
        detail: t('environmentStatus.inferredHint'),
        inferred: true,
      });
    }

    setChecks(nextChecks.sort((a, b) => statusRank(b.status) - statusRank(a.status)));
    setLastChecked(started);
    setLoading(false);
  }, [appEnvLabel, currentUser, projectRef, supabaseUrl, t]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const summary = useMemo(() => ({
    ready: checks.filter(check => check.status === 'connected').length,
    attention: checks.filter(check => check.status === 'warning').length,
    down: checks.filter(check => check.status === 'disconnected').length,
  }), [checks]);

  const groupedChecks = useMemo(() => (
    GROUP_ORDER.map(group => ({
      group,
      checks: checks.filter(check => check.group === group),
    })).filter(item => item.checks.length > 0)
  ), [checks]);

  const groupLabels: Record<CheckGroup, string> = {
    app: t('environmentStatus.group.app'),
    supabase: t('environmentStatus.group.supabase'),
    google: t('environmentStatus.group.google'),
    notifications: t('environmentStatus.group.notifications'),
    storage: t('environmentStatus.group.storage'),
  };

  const groupIcons: Record<CheckGroup, typeof Cloud> = {
    app: Cloud,
    supabase: Database,
    google: FileCheck2,
    notifications: MailCheck,
    storage: HardDrive,
  };

  return (
    <div className="min-h-full bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <header className="rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1 text-xs font-medium text-[#525252]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#737373]" />
                  {t('environmentStatus.badge')}
                </span>
                <span className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1 text-xs font-medium text-[#737373]">
                  {[
                    { label: t('environmentStatus.summary.ready'), value: summary.ready, tone: 'text-[#137333]' },
                    { label: t('environmentStatus.summary.attention'), value: summary.attention, tone: 'text-[#92400e]' },
                    { label: t('environmentStatus.summary.down'), value: summary.down, tone: 'text-[#b42318]' },
                  ].map(item => (
                    <span key={item.label} className="inline-flex items-center gap-1.5">
                      <span className={`font-semibold ${item.tone}`}>{item.value}</span>
                      <span>{item.label}</span>
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
              <p className="text-xs font-medium text-[#737373]">
                {lastChecked
                  ? t('environmentStatus.lastChecked', { time: formatPlatformDateTime(lastChecked.toISOString()) ?? lastChecked.toLocaleString() })
                  : t('environmentStatus.neverChecked')}
              </p>
              <button
                type="button"
                onClick={() => void runChecks()}
                disabled={loading}
                className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? t('environmentStatus.running') : t('environmentStatus.runChecks')}
              </button>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#171717]">{t('environmentStatus.title')}</h1>
              <p className="mt-2 w-full text-sm leading-6 text-[#525252]">{t('environmentStatus.desc')}</p>
            </div>
          </div>
        </header>

        {checks.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-10 text-center text-sm text-[#525252]">
            {t('environmentStatus.empty')}
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-4">
              {groupedChecks.map(({ group, checks: groupChecks }) => {
                const Icon = groupIcons[group];
                return (
                  <section key={group} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 place-items-center rounded-xl border ${groupTone(group)}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                        <h2 className="text-sm font-semibold text-[#171717]">{groupLabels[group]}</h2>
                      </div>
                      <span className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 text-xs font-medium text-[#737373]">
                        {groupChecks.length}
                      </span>
                    </div>
                    <div className="divide-y divide-[#e5e5e5]">
                      {groupChecks.map(check => (
                        <article key={check.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.3fr)_150px] md:items-start">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-[#171717]">{check.title}</h3>
                              {check.inferred && (
                                <span className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                                  {t('environmentStatus.inferred')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm leading-6 text-[#525252]">{check.message}</p>
                            {check.detail && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-xs font-semibold text-[#525252] hover:text-[#171717]">
                                  {t('environmentStatus.details')}
                                </summary>
                                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs leading-5 text-[#404040]">
                                  {check.detail}
                                </pre>
                              </details>
                            )}
                          </div>
                          <div className={`inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold md:justify-self-end ${statusClasses(check.status)}`}>
                            <StatusIcon status={check.status} />
                            {t(`environmentStatus.${check.status}` as TranslationKey)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </main>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('environmentStatus.appUrl')}</p>
                <p className="mt-2 break-all text-sm leading-6 text-[#404040]">{window.location.origin}</p>
              </section>

              <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#d2e3fc] bg-[#f7faff] text-[#1a73e8]">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717]">{t('environmentStatus.knowledgeBaseTitle')}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#525252]">{t('environmentStatus.knowledgeBaseDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('knowledge-base')}
                  className="tbo-focus mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d2e3fc] bg-white px-4 text-sm font-semibold text-[#1a73e8] transition hover:bg-[#f7faff]"
                >
                  <BookOpen className="h-4 w-4" />
                  {t('sidebar.knowledgeBase')}
                </button>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
