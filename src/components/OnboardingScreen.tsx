import {
  ArrowUpRight,
  CheckCircle,
  ClipboardList,
  LogOut,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import tboLogo from '../assets/tbo-logo.svg';

interface OnboardingScreenProps {
  userName: string;
  onSignOut: () => void;
}

const APPLY_URL =
  'https://theburningones.bg/%d0%bd%d0%b0%d1%88%d0%b8%d1%82%d0%b5-%d0%b2%d1%8f%d1%80%d0%b2%d0%b0%d0%bd%d0%b8%d1%8f/';

const WHO_CAN_APPLY = [
  '18 years of age or older',
  'Has accepted Jesus Christ as Lord and Savior',
  'Completed application form',
  "Pastor's recommendation letter",
  'Passport photo (digital file)',
];

const STEPS = [
  {
    number: 1,
    title: 'Application',
    icon: ClipboardList,
    description:
      "Submit your application form along with your pastor's recommendation. Contact your pastor in advance to ensure the recommendation is submitted on time.",
  },
  {
    number: 2,
    title: 'Interview',
    icon: Users,
    description:
      'After receiving your application and recommendation, our team will contact you to schedule an in-person interview at Zoe West, Tsaritsa Yoanna Blvd 160.',
  },
  {
    number: 3,
    title: 'Feedback',
    icon: Mail,
    description:
      'Expect to receive an email with feedback within two weeks of your interview.',
  },
];

export function OnboardingScreen({ userName, onSignOut }: OnboardingScreenProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-[#171717]">
      <div className="absolute inset-0 tbo-dot-grid opacity-60" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#e5e5e5] bg-white">
              <img src={tboLogo} alt="" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-[#171717]">The Burning Ones</p>
              <p className="mt-1 text-[11px] font-medium text-[#737373]">Application review</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="tbo-button-secondary flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <main className="flex-1 py-8 lg:py-12">
          <section className="mx-auto max-w-4xl">
            <div className="tbo-card overflow-hidden bg-white shadow-[rgba(0,0,0,0.1)_0px_0px_0px_4px]">
              <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="flex flex-col items-center justify-center border-b border-[#e5e5e5] bg-[#f5f5f5] p-8 text-center lg:border-b-0 lg:border-r">
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-[#e5e5e5] bg-white p-4">
                    <img src={tboLogo} alt="The Burning Ones" className="h-full w-full object-contain" />
                  </div>
                  <span className="mt-5 rounded-full bg-[#fff7ed] px-3 py-1 text-sm font-medium text-[#c2410c]">
                    Review required
                  </span>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-[#525252]">
                    Signing in creates your account, but school access is granted only after the
                    application and role review process.
                  </p>
                </div>

                <div className="p-5 sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#171717]">
                    <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
                    Google sign-in complete
                  </div>

                  <h1 className="tbo-display mt-5 text-4xl leading-none text-[#171717] sm:text-5xl">
                    Hi {userName}, your account is under review.
                  </h1>

                  <p className="mt-5 text-base leading-7 text-[#525252] sm:text-lg">
                    Thanks for signing in. This does not confirm admission or platform access yet.
                    An administrator will review your application status and assign access if you
                    are approved for the school.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {STEPS.map(step => (
                      <div key={step.number} className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5] text-sm font-semibold text-[#171717]">
                          {step.number}
                        </div>
                        <step.icon className="mb-2 h-4 w-4 text-[#2563eb]" />
                        <h2 className="text-sm font-semibold text-[#171717]">{step.title}</h2>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={APPLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tbo-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
                    >
                      View application info
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <a
                      href="https://theburningones.bg/en/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tbo-button-secondary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
                    >
                      Visit school site
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="tbo-card p-4">
                <h2 className="text-sm font-semibold text-[#171717]">About The Burning Ones</h2>
                <p className="mt-3 text-sm leading-6 text-[#525252]">
                  The Burning Ones is a structured Bible school program run by Zoe Church Sofia.
                  Sessions meet every Tuesday and Thursday from 7:00 PM to 9:00 PM, with one
                  Saturday per month from 10:00 AM to 3:00 PM, and twice-monthly attendance at
                  &quot;The Well&quot;.
                </p>
              </div>

              <div className="tbo-card bg-white p-4">
                <h2 className="text-sm font-semibold text-[#171717]">Basic requirements</h2>
                <ul className="mt-3 space-y-2">
                  {WHO_CAN_APPLY.slice(0, 4).map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-[#525252]">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#16a34a]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#e5e5e5] py-4 text-center text-xs font-medium text-[#737373] sm:text-left">
          The Burning Ones. Platform access depends on application review and role assignment.
        </footer>
      </div>
    </div>
  );
}
