import { Link } from 'react-router-dom'
import { GraduationCap, BookOpen, Users, Award, Calendar, MessageSquare, ArrowRight, Check } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-100">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-cream-50/95 backdrop-blur border-b border-cream-300">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/image.png" alt="Durable Schools" className="w-10 h-10 rounded-lg object-cover" />
            <span className="font-display text-xl font-bold text-brown-800">Durable Schools</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="btn btn-ghost text-sm">Sign In</Link>
            <Link to="/auth?mode=signup" className="btn btn-primary text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid-paper">
        <div className="absolute inset-0 bg-gradient-to-b from-cream-50/80 to-cream-100" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-600 text-sm font-medium mb-6">
              <Award className="w-4 h-4" />
              Nigerian K-12 Learning & School Management
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-bold text-brown-800 leading-tight mb-6">
              Where schools run smarter, and students learn deeper.
            </h1>
            <p className="text-lg text-brown-500 mb-8 leading-relaxed">
              Durable Schools unites teachers, students, parents, and administrators on one
              platform — from class management and live lessons to assessments, results, and
              payments. Built for the Nigerian school system, optimized for low-bandwidth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth?mode=signup" className="btn btn-primary text-base px-6 py-3">
                Start Your School <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/auth" className="btn btn-outline text-base px-6 py-3">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-brown-800 mb-3">
            Everything your school needs, in one place
          </h2>
          <p className="text-brown-400 max-w-2xl mx-auto">
            From Primary 1 to SS3, across Science, Arts, and Commercial streams —
            Durable Schools handles the full academic lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, title: 'Academic Structure', desc: 'Full Nigerian K-12 class setup with arms, streams, subjects, and term management.' },
            { icon: GraduationCap, title: 'Virtual Classrooms', desc: 'Upload materials, run live lessons with screen-share, and auto-record for revision.' },
            { icon: Calendar, title: 'Assessment Engine', desc: 'Quizzes, tests, and exams with auto-grading, question banks, and cross-class assessments.' },
            { icon: Award, title: 'Results & Report Cards', desc: 'CA + exam scoring, teacher remarks, and downloadable PDF report cards.' },
            { icon: Users, title: 'Parent Portal', desc: 'Multi-child dashboards, performance trends, attendance alerts, and direct messaging.' },
            { icon: MessageSquare, title: 'Communication', desc: 'In-app messaging, school-wide announcements, and multi-channel notifications.' }
          ].map((f) => (
            <div key={f.title} className="card hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-brown-800 mb-2">{f.title}</h3>
              <p className="text-brown-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="bg-brown-600 text-cream-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-cream-100 mb-3">
              Built for every role in your school
            </h2>
            <p className="text-cream-200 max-w-2xl mx-auto">
              Each user sees exactly what they need — and nothing they shouldn't.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'School Admin', desc: 'Configure classes, subjects, terms, staff, fees, and broadcast announcements.' },
              { title: 'Teacher', desc: 'Manage classrooms, upload materials, run live classes, set and grade assessments.' },
              { title: 'Student', desc: 'Access materials, join live classes, take assessments, and download results.' },
              { title: 'Parent', desc: 'Monitor performance, attendance, fees, and message teachers — all in one place.' }
            ].map((r) => (
              <div key={r.title} className="bg-brown-700/50 rounded-xl p-6 border border-brown-500">
                <h3 className="text-lg font-semibold text-amber-300 mb-2">{r.title}</h3>
                <p className="text-cream-200 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nigerian context */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-display font-bold text-brown-800 mb-4">
              Built for Nigerian connectivity realities
            </h2>
            <div className="space-y-4">
              {[
                'Low-bandwidth mode with auto-compressed video and audio-only options',
                'SMS fallback for critical alerts to parents without smartphones',
                'Offline mode — download materials on Wi-Fi, submit when back online',
                'PWA installable on entry-level Android phones',
                'Paystack integration for card, bank transfer, and USSD payments'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-sage-500" />
                  </div>
                  <p className="text-brown-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card bg-gradient-to-br from-cream-50 to-cream-200">
            <div className="text-center py-8">
              <img src="/images/image.png" alt="Durable Schools" className="w-24 h-24 rounded-2xl mx-auto mb-6 object-cover shadow-md" />
              <h3 className="font-display text-xl font-bold text-brown-800 mb-2">Durable Schools</h3>
              <p className="text-brown-400 text-sm mb-6">Academic Excellence • Moral Uprightness • Social Compatibility</p>
              <Link to="/auth?mode=signup" className="btn btn-primary">
                Create Your School <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brown-800 text-cream-200 py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <p className="text-sm">Durable Schools — Nigerian K-12 Learning & School Management Platform</p>
          <p className="text-xs text-cream-300 mt-2">Built with care for Nigerian schools and families.</p>
        </div>
      </footer>
    </div>
  )
}
