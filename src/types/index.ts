export type UserRole = 'admin' | 'teacher' | 'student' | 'parent'

export interface Profile {
  id: string
  school_id: string | null
  role: UserRole
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  photo_url: string | null
  bio: string | null
  qualification: string | null
  preferred_channel: 'sms' | 'email' | 'push' | 'whatsapp'
  is_active: boolean
  two_factor_enabled: boolean
  created_at: string
}

export interface School {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  motto: string | null
}

export interface Class {
  id: string
  school_id: string
  name: string
  level: string
  arm: string
  stream: string | null
}

export interface Subject {
  id: string
  school_id: string
  name: string
  code: string | null
}

export interface ClassSubject {
  id: string
  class_id: string
  subject_id: string
  is_core: boolean
  subject?: Subject
}

export interface AcademicSession {
  id: string
  school_id: string
  session_name: string
  term: string
  start_date: string
  end_date: string
  is_current: boolean
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface StudentEnrollment {
  id: string
  student_id: string
  class_id: string
  session_id: string | null
  admission_number: string | null
  parent_id: string | null
  created_at: string
}

export interface Classroom {
  id: string
  school_id: string
  class_id: string
  subject_id: string
  teacher_id: string
  name: string
  description: string | null
}

export interface Material {
  id: string
  classroom_id: string
  title: string
  description: string | null
  file_url: string | null
  file_type: string | null
  external_url: string | null
  topic: string | null
  week: number | null
  created_at: string
}

export interface LiveClass {
  id: string
  classroom_id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  meeting_url: string | null
  recording_url: string | null
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
}

export interface Assessment {
  id: string
  classroom_id: string
  title: string
  type: 'quiz' | 'test' | 'exam'
  total_marks: number
  ca_weight: number
  exam_weight: number
  duration_minutes: number | null
  max_attempts: number
  randomize_questions: boolean
  open_at: string | null
  close_at: string | null
  is_combined: boolean
  is_published: boolean
}

export interface Question {
  id: string
  subject_id: string
  school_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay'
  options: string[] | null
  correct_answer: string | null
  marks: number
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  question_id: string
  display_order: number
  question?: Question
}

export interface AssessmentSubmission {
  id: string
  assessment_id: string
  student_id: string
  status: 'in_progress' | 'submitted' | 'graded'
  score: number | null
  started_at: string
  submitted_at: string | null
  graded_at: string | null
}

export interface Answer {
  id: string
  submission_id: string
  question_id: string
  answer_text: string | null
  file_url: string | null
  is_correct: boolean | null
  marks_awarded: number
  teacher_comment: string | null
}

export interface GradebookEntry {
  id: string
  student_id: string
  subject_id: string
  class_id: string
  session_id: string | null
  ca_score: number
  exam_score: number
  total_score: number
  grade: string | null
  teacher_remark: string | null
  is_released: boolean
}

export interface AttendanceRecord {
  id: string
  student_id: string
  class_id: string
  subject_id: string | null
  session_id: string | null
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  note: string | null
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  body: string
  is_read: boolean
  created_at: string
}

export interface Announcement {
  id: string
  school_id: string
  author_id: string
  title: string
  body: string
  target_class_id: string | null
  is_school_wide: boolean
  created_at: string
}

export interface Fee {
  id: string
  school_id: string
  name: string
  amount: number
  class_id: string | null
  session_id: string | null
  due_date: string | null
  fee_type: 'term' | 'holiday' | 'programme'
}

export interface Invoice {
  id: string
  student_id: string
  fee_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  due_date: string | null
  paid_at: string | null
  created_at: string
  fee?: Fee
}

export interface Payment {
  id: string
  invoice_id: string
  student_id: string
  amount: number
  paystack_reference: string | null
  status: 'pending' | 'success' | 'failed'
  paid_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  channel: 'in_app' | 'sms' | 'email' | 'push' | 'whatsapp'
  is_read: boolean
  related_type: string | null
  related_id: string | null
  created_at: string
}

export interface Badge {
  id: string
  school_id: string
  name: string
  description: string | null
  icon: string | null
}

export interface Forum {
  id: string
  classroom_id: string
}

export interface ForumPost {
  id: string
  forum_id: string
  author_id: string
  title: string
  body: string
  parent_post_id: string | null
  is_flagged: boolean
  created_at: string
}

export interface CalendarEvent {
  id: string
  school_id: string
  title: string
  description: string | null
  event_type: 'live_class' | 'assessment' | 'homework' | 'school_event' | 'holiday'
  start_at: string | null
  end_at: string | null
  target_class_id: string | null
}

export interface AuditLog {
  id: string
  school_id: string | null
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface HolidayProgram {
  id: string
  school_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  fee_amount: number
}

export interface ResourceBankItem {
  id: string
  school_id: string
  title: string
  description: string | null
  file_url: string | null
  subject_id: string | null
  topic: string | null
  resource_type: string | null
}
