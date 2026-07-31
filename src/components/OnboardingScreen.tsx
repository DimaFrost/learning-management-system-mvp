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
import { useLanguage } from '../i18n/LanguageContext';

interface OnboardingScreenProps {
  userName: string;
  onSignOut: () => void;
}

const APPLY_URL =
  'https://theburningones.bg/%d0%bd%d0%b0%d1%88%d0%b8%d1%82%d0%b5-%d0%b2%d1%8f%d1%80%d0%b2%d0%b0%d0%bd%d0%b8%d1%8f/';

export function OnboardingScreen({ userName, onSignOut }: OnboardingScreenProps) {
  const { t } = useLanguage();
  const whoCanApply = [
    t('onboarding.req.age'),
    t('onboarding.req.faith'),
    t('onboarding.req.application'),
    t('onboarding.req.recommendation'),
  ];
  const steps = [
    { number: 1, title: t('onboarding.step.application'), icon: ClipboardList },
    { number: 2, title: t('onboarding.step.interview'), icon: Users },
    { number: 3, title: t('onboarding.step.feedback'), icon: Mail },
  ];

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
              <p className="text-sm font-semibold leading-none text-[#171717]">{t('app.brand')}</p>
              <p className="mt-1 text-[11px] font-medium text-[#737373]">{t('onboarding.applicationReview')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="tbo-button-secondary flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
            title={t('header.signOut')}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t('header.signOut')}</span>
          </button>
        </header>

        <main className="flex-1 py-8 lg:py-12">
          <section className="mx-auto max-w-4xl">
            <div className="tbo-card overflow-hidden bg-white shadow-[rgba(0,0,0,0.1)_0px_0px_0px_4px]">
              <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="flex flex-col items-center justify-center border-b border-[#e5e5e5] bg-[#f5f5f5] p-8 text-center lg:border-b-0 lg:border-r">
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-[#e5e5e5] bg-white p-4">
                    <img src={tboLogo} alt={t('app.brand')} className="h-full w-full object-contain" />
                  </div>
                  <span className="mt-5 rounded-full bg-[#fff7ed] px-3 py-1 text-sm font-medium text-[#c2410c]">
                    {t('onboarding.reviewRequired')}
                  </span>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-[#525252]">
                    {t('onboarding.accountCreatedNote')}
                  </p>
                </div>

                <div className="p-5 sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#171717]">
                    <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
                    {t('onboarding.googleComplete')}
                  </div>

                  <h1 className="tbo-display mt-5 text-4xl leading-none text-[#171717] sm:text-5xl">
                    {t('onboarding.underReviewTitle', { name: userName })}
                  </h1>

                  <p className="mt-5 text-base leading-7 text-[#525252] sm:text-lg">
                    {t('onboarding.underReviewBody')}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {steps.map(step => (
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
                      {t('onboarding.viewApplicationInfo')}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <a
                      href="https://theburningones.bg/en/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tbo-button-secondary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
                    >
                      {t('onboarding.visitSchoolSite')}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="tbo-card p-4">
                <h2 className="text-sm font-semibold text-[#171717]">{t('onboarding.aboutTitle')}</h2>
                <p className="mt-3 text-sm leading-6 text-[#525252]">
                  {t('onboarding.aboutBody')}
                </p>
              </div>

              <div className="tbo-card bg-white p-4">
                <h2 className="text-sm font-semibold text-[#171717]">{t('onboarding.requirementsTitle')}</h2>
                <ul className="mt-3 space-y-2">
                  {whoCanApply.map(item => (
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
          {t('onboarding.footer')}
        </footer>
      </div>
    </div>
  );
}
