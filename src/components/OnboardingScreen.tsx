import {
  GraduationCap,
  LogOut,
  CheckCircle,
  ClipboardList,
  Users,
  Mail,
} from 'lucide-react';

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
      'After receiving your application and recommendation, our team will contact you to schedule an in-person interview at Zoe West — Tsaritsa Yoanna Blvd 160.',
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
    <div className="min-h-screen bg-amber-50/30 flex flex-col">
      {/* Section 1 — Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <GraduationCap className="w-8 h-8 text-amber-600" />
            <h1 className="text-xl font-semibold text-gray-900">The Burning Ones</h1>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 p-2 text-gray-500 hover:text-gray-700"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Section 2 — Welcome hero */}
        <section className="max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Welcome, {userName}!
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Your account has been created successfully. An administrator will review and assign
            your role shortly. Once approved, you will have full access to the platform.
          </p>
          <span className="inline-block px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
            Access Pending Approval
          </span>
        </section>

        {/* Section 3 — About */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg border border-amber-100 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About The Burning Ones</h3>
              <p className="text-gray-600 leading-relaxed">
                The Burning Ones is a structured Bible school program run by Zoe Church Sofia.
                Classes meet every Tuesday and Thursday from 7:00 PM to 9:00 PM, with one Saturday
                per month from 10:00 AM to 3:00 PM, and twice-monthly attendance at &quot;The Well&quot;.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-amber-100 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Who Can Apply?</h3>
              <ul className="space-y-3">
                {WHO_CAN_APPLY.map(item => (
                  <li key={item} className="flex items-start gap-3 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 — Application process */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-8">
            Application Process
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(step => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-lg mb-3">
                  {step.number}
                </div>
                <step.icon className="w-6 h-6 text-amber-600 mb-2" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5 — CTA */}
        <section className="max-w-5xl mx-auto px-6 py-10 text-center">
          <a
            href={APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 text-lg font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-md"
          >
            Apply Now
          </a>
          <p className="mt-4 text-sm text-gray-500 max-w-md mx-auto">
            Already applied? Your access will be granted once an administrator reviews your
            account.
          </p>
        </section>
      </main>

      {/* Section 6 — Footer */}
      <footer className="border-t border-amber-100 bg-white px-6 py-6 mt-auto">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500 space-y-1">
          <p>&copy; The Burning Ones. All rights reserved.</p>
          <a
            href="https://theburningones.bg/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 hover:text-amber-800"
          >
            theburningones.bg/en/
          </a>
        </div>
      </footer>
    </div>
  );
}
