import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { cn, getInitials } from '@/lib/utils'
import {
  LayoutDashboard, GraduationCap, BookOpen, ClipboardList, Users,
  DollarSign, Megaphone, Calendar, User, LogOut, Menu, X,
  School, FileText, History, Sun, Library, MessageSquare,
  Award, BarChart3, ClipboardCheck, Settings
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Classes & Arms', path: '/admin/classes', icon: School },
  { label: 'Subjects', path: '/admin/subjects', icon: BookOpen },
  { label: 'Sessions & Terms', path: '/admin/sessions', icon: Calendar },
  { label: 'Staff', path: '/admin/staff', icon: Users },
  { label: 'Assignments', path: '/admin/assignments', icon: ClipboardCheck },
  { label: 'Students', path: '/admin/students', icon: GraduationCap },
  { label: 'Fees & Billing', path: '/admin/fees', icon: DollarSign },
  { label: 'Announcements', path: '/admin/announcements', icon: Megaphone },
  { label: 'Holiday Programs', path: '/admin/holidays', icon: Sun },
  { label: 'Resource Bank', path: '/admin/resources', icon: Library },
  { label: 'Audit Log', path: '/admin/audit', icon: History }
]

const teacherNav: NavItem[] = [
  { label: 'Dashboard', path: '/teacher', icon: LayoutDashboard },
  { label: 'Assessments', path: '/teacher/assessments', icon: ClipboardList },
  { label: 'Gradebook', path: '/teacher/gradebook', icon: BarChart3 },
  { label: 'Attendance', path: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'Messages', path: '/teacher/messages', icon: MessageSquare },
  { label: 'Calendar', path: '/calendar', icon: Calendar }
]

const studentNav: NavItem[] = [
  { label: 'Dashboard', path: '/student', icon: LayoutDashboard },
  { label: 'Assessments', path: '/student/assessments', icon: ClipboardList },
  { label: 'Results', path: '/student/results', icon: FileText },
  { label: 'Messages', path: '/student/messages', icon: MessageSquare },
  { label: 'Calendar', path: '/calendar', icon: Calendar }
]

const parentNav: NavItem[] = [
  { label: 'Dashboard', path: '/parent', icon: LayoutDashboard },
  { label: 'Performance', path: '/parent/performance', icon: BarChart3 },
  { label: 'Attendance', path: '/parent/attendance', icon: ClipboardCheck },
  { label: 'Fees', path: '/parent/fees', icon: DollarSign },
  { label: 'Messages', path: '/parent/messages', icon: MessageSquare }
]

function getNavItems(role: string | undefined): NavItem[] {
  switch (role) {
    case 'admin': return adminNav
    case 'teacher': return teacherNav
    case 'student': return studentNav
    case 'parent': return parentNav
    default: return []
  }
}

function getHomePath(role: string | undefined): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'teacher': return '/teacher'
    case 'student': return '/student'
    case 'parent': return '/parent'
    default: return '/'
  }
}

export default function AppLayout() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = getNavItems(profile?.role)
  const homePath = getHomePath(profile?.role)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : ''
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-brown-900/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen w-64 bg-cream-50 border-r border-cream-300 z-40 transition-transform duration-300 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-cream-300">
          <img src="/images/image.png" alt="Durable Schools" className="w-10 h-10 rounded-lg object-cover" />
          <div>
            <h1 className="font-display text-lg font-bold text-brown-800 leading-tight">Durable Schools</h1>
            <p className="text-xs text-brown-400">Learning Platform</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === homePath}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn('sidebar-link', isActive && 'sidebar-link-active')
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-cream-300 p-3 space-y-1">
          <NavLink to="/profile" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
            <User className="w-5 h-5 shrink-0" />
            <span className="text-sm">My Profile</span>
          </NavLink>
          <button onClick={handleSignOut} className="sidebar-link w-full text-error-600 hover:bg-error-50">
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-cream-50/95 backdrop-blur border-b border-cream-300 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-brown-50 text-brown-600"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <p className="text-sm text-brown-400">Welcome back,</p>
              <p className="font-semibold text-brown-700">{fullName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="badge badge-brown hidden sm:inline-flex">{roleLabel}</span>
            <div className="w-10 h-10 rounded-full bg-brown-600 text-cream-100 flex items-center justify-center font-semibold text-sm">
              {getInitials(fullName)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
