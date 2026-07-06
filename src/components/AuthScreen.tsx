import {
  ArrowRight,
  BadgeCheck,
  CheckCircle,
  FileText,
  LogIn,
  MailCheck,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import authArtifactImage from '../assets/tbo-auth-artifact.jpg';
import tboLogo from '../assets/tbo-logo.svg';

interface AuthScreenProps {
  onSignIn: () => void;
  error: string | null;
}

export function AuthScreen({ onSignIn, error }: AuthScreenProps) {
  const reviewSteps = [
    {
      icon: FileText,
      title: 'Application record matched',
      description: 'Use the Google account connected to your application or school profile.',
    },
    {
      icon: UserCheck,
      title: 'Status checked',
      description: 'The school confirms admission status and active role access.',
    },
    {
      icon: CheckCircle,
      title: 'Workspace opened',
      description: 'Approved users continue straight into the LMS.',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8f8f6] text-[#121212]">
      <div className="absolute inset-0 opacity-[0.35]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(18,18,18,0.075)_1px,transparent_0)] bg-[length:24px_24px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-lg px-1 py-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-[#e7e6e1] bg-white">
              <img src={tboLogo} alt="" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-medium leading-none text-[#121212]">The Burning Ones</p>
              <p className="mt-1 text-[11px] font-normal text-[#7b7974]">School access</p>
            </div>
          </div>
          <span className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#373734] sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d97757]" />
            Zoe Sofia
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-10 lg:py-12">
          <section className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.78fr)] lg:items-start">
            <div className="overflow-hidden rounded-[24px] border border-[#e7e6e1] bg-white shadow-[rgba(0,0,0,0.04)_0px_4px_20px_0px]">
              <div className="grid min-h-[536px] grid-rows-[auto_1fr_auto]">
                <div className="flex items-center justify-between border-b border-[#e7e6e1] bg-white px-5 py-4">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-[#efeeeb] px-3 py-1.5 text-[11px] font-medium text-[#373734]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#121212]" />
                    Google account required
                  </span>
                  <span className="hidden text-[11px] font-normal text-[#9c9a92] sm:inline">
                    LMS access is role based
                  </span>
                </div>

                <div className="flex flex-col justify-center px-6 py-10 sm:px-8 lg:px-10">
                  <div className="max-w-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#e7e6e1] bg-white p-3">
                        <img src={tboLogo} alt="The Burning Ones" className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7b7974]">
                          Learning Management System
                        </p>
                        <h1 className="mt-2 font-serif text-[30px] font-normal leading-[1.2] text-[#121212] sm:text-[40px]">
                          The Burning Ones
                        </h1>
                      </div>
                    </div>

                    <div className="mt-10 max-w-md">
                      <div className="mb-4 h-1.5 w-1.5 rounded-full bg-[#d97757]" />
                      <h2 className="font-serif text-[30px] font-normal leading-[1.2] text-[#121212]">
                        Sign in to continue.
                      </h2>
                      <p className="mt-3 text-[15px] font-normal leading-7 text-[#373734]">
                        Access is based on the school record connected to your Google account.
                      </p>
                    </div>

                    <div className="mt-7 max-w-md rounded-2xl border border-[#e7e6e1] bg-[#efeeeb] p-2">
                      {error && (
                        <p className="mb-2 rounded-lg border border-[#d97757]/40 bg-white px-3 py-2 text-sm font-medium text-[#121212]">
                          {error}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={onSignIn}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#121212] px-5 py-3 text-[15px] font-medium text-[#f8f8f6] transition-colors hover:bg-[#373734]"
                      >
                        <LogIn className="h-4 w-4" />
                        Sign in with Google
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-4 max-w-md rounded-2xl border border-[#e7e6e1] bg-white px-4 py-3 text-xs font-normal leading-5 text-[#7b7974]">
                      Signing in does not confirm admission. Access opens only when the school record is approved.
                    </p>
                  </div>
                </div>

                <div className="grid gap-px border-t border-[#e7e6e1] bg-[#e7e6e1] sm:grid-cols-3">
                  {[
                    { icon: BadgeCheck, label: 'Known applicants', value: 'Reviewed' },
                    { icon: MailCheck, label: 'School access', value: 'Role based' },
                    { icon: ShieldCheck, label: 'Session', value: 'Protected' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#efeeeb]">
                        <item.icon className="h-4 w-4 text-[#121212]" />
                      </span>
                      <div>
                        <p className="text-xs font-normal text-[#7b7974]">{item.label}</p>
                        <p className="text-sm font-medium text-[#121212]">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="grid gap-5">
              <div className="overflow-hidden rounded-[24px] border border-[#e7e6e1] bg-white shadow-[rgba(0,0,0,0.04)_0px_4px_20px_0px]">
                <img
                  src={authArtifactImage}
                  alt="The Burning Ones printed school material"
                  className="h-[324px] w-full object-cover"
                />
              </div>

              <div className="rounded-2xl border border-[#e7e6e1] bg-white">
                <div className="border-b border-[#e7e6e1] px-4 py-3">
                  <h2 className="font-serif text-2xl font-normal leading-[1.33] text-[#121212]">After Google sign-in</h2>
                  <p className="mt-1 text-sm leading-6 text-[#7b7974]">
                  The app checks your school status before opening a workspace.
                  </p>
                </div>

                <div className="divide-y divide-[#e7e6e1]">
                  {reviewSteps.map((step, index) => (
                    <div key={step.title} className="grid grid-cols-[36px_1fr] gap-3 px-4 py-3">
                      <div className="relative">
                        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[#efeeeb]">
                          <step.icon className="h-4 w-4 text-[#121212]" />
                        </div>
                        {index < reviewSteps.length - 1 && (
                          <span className="absolute left-1/2 top-10 h-5 w-px -translate-x-1/2 bg-[#e7e6e1]" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-[#121212]">{step.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#373734]">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </main>

        <footer className="py-4 text-center text-xs font-normal text-[#9c9a92] sm:text-left">
          The Burning Ones LMS
        </footer>
      </div>
    </div>
  );
}
