import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import LandingPage from '@/pages/LandingPage'
import AuthPage from '@/pages/AuthPage'
import AppLayout from '@/components/layout/AppLayout'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminClasses from '@/pages/admin/AdminClasses'
import AdminSubjects from '@/pages/admin/AdminSubjects'
import AdminSessions from '@/pages/admin/AdminSessions'
import AdminStaff from '@/pages/admin/AdminStaff'
import AdminAssignments from '@/pages/admin/AdminAssignments'
import AdminStudents from '@/pages/admin/AdminStudents'
import AdminFees from '@/pages/admin/AdminFees'
import AdminAnnouncements from '@/pages/admin/AdminAnnouncements'
import AdminAuditLog from '@/pages/admin/AdminAuditLog'
import AdminHolidayPrograms from '@/pages/admin/AdminHolidayPrograms'
import AdminResourceBank from '@/pages/admin/AdminResourceBank'
import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import TeacherClassroom from '@/pages/teacher/TeacherClassroom'
import TeacherAssessments from '@/pages/teacher/TeacherAssessments'
import TeacherGradebook from '@/pages/teacher/TeacherGradebook'
import TeacherAttendance from '@/pages/teacher/TeacherAttendance'
import TeacherMessages from '@/pages/teacher/TeacherMessages'
import StudentDashboard from '@/pages/student/StudentDashboard'
import StudentClassroom from '@/pages/student/StudentClassroom'
import StudentAssessments from '@/pages/student/StudentAssessments'
import StudentResults from '@/pages/student/StudentResults'
import StudentMessages from '@/pages/student/StudentMessages'
import ParentDashboard from '@/pages/parent/ParentDashboard'
import ParentPerformance from '@/pages/parent/ParentPerformance'
import ParentAttendance from '@/pages/parent/ParentAttendance'
import ParentFees from '@/pages/parent/ParentFees'
import ParentMessages from '@/pages/parent/ParentMessages'
import ProfilePage from '@/pages/ProfilePage'
import CalendarPage from '@/pages/CalendarPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin mb-4" />
          <p className="text-brown-500 font-medium">Loading Durable Schools...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/classes" element={<AdminClasses />} />
        <Route path="/admin/subjects" element={<AdminSubjects />} />
        <Route path="/admin/sessions" element={<AdminSessions />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
        <Route path="/admin/assignments" element={<AdminAssignments />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/fees" element={<AdminFees />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/audit" element={<AdminAuditLog />} />
        <Route path="/admin/holidays" element={<AdminHolidayPrograms />} />
        <Route path="/admin/resources" element={<AdminResourceBank />} />

        {/* Teacher routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/classroom/:id" element={<TeacherClassroom />} />
        <Route path="/teacher/assessments" element={<TeacherAssessments />} />
        <Route path="/teacher/gradebook" element={<TeacherGradebook />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/messages" element={<TeacherMessages />} />

        {/* Student routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/classroom/:id" element={<StudentClassroom />} />
        <Route path="/student/assessments" element={<StudentAssessments />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route path="/student/messages" element={<StudentMessages />} />

        {/* Parent routes */}
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/performance" element={<ParentPerformance />} />
        <Route path="/parent/attendance" element={<ParentAttendance />} />
        <Route path="/parent/fees" element={<ParentFees />} />
        <Route path="/parent/messages" element={<ParentMessages />} />

        {/* Shared routes */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
