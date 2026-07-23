/*
# Durable Schools — Initial Schema

## Overview
Creates the complete database schema for the Durable Schools platform — a multi-tenant
Nigerian K-12 learning and school management system supporting Admin, Teacher, Student,
and Parent roles. This migration covers all three build phases: academic structure,
classrooms, assessments, grading, payments, live classes, gamification, and analytics.

## Tables Created
1. schools — top-level tenant; each school has a unique code
2. profiles — extends auth.users with role, school linkage, and role-specific metadata
3. classes — Nigerian K-12 classes (Primary 1-6, JSS 1-3, SS 1-3) with arms/streams
4. subjects — master subject list reusable across classes
5. class_subjects — maps subjects to classes with core/elective flag
6. academic_sessions — academic year with terms and date ranges
7. teacher_assignments — links teachers to subject + class combinations (admin-approved)
8. student_enrollments — places students into class/arms; auto-generates subject list
9. classrooms — one virtual classroom per subject-class combination
10. materials — uploaded learning materials (PDFs, slides, video, audio, links)
11. live_classes — scheduled live video sessions with recording links
12. assessments — quizzes, tests, exams with config (duration, attempts, window)
13. questions — question bank per subject; multiple question types
14. assessment_questions — links questions to specific assessments
15. assessment_submissions — student submission with score and status
16. answers — individual question answers within a submission
17. gradebook — per-student per-subject per-term scores (CA + exam)
18. results — published term results visible to students/parents
19. attendance — daily/per-class attendance records
20. messages — direct messaging between roles
21. announcements — broadcast announcements (school-wide or class-level)
22. fees — fee structures per class/programme/term
23. invoices — generated invoices per student
24. payments — payment records linked to Paystack
25. notifications — multi-channel notification queue (push, SMS, email, WhatsApp)
26. badges — gamification badges
27. student_badges — badges earned by students
28. forums — discussion forum per subject
29. forum_posts — posts within a forum
30. calendar_events — unified calendar for all roles
31. audit_logs — audit trail of key actions
32. holiday_programs — holiday/summer lesson programmes
33. holiday_registrations — student opt-in to holiday programmes
34. device_sessions — active device sessions for remote logout
35. resource_bank — searchable library of past questions and reference materials

## Security
- RLS enabled on every table.
- All policies scoped to authenticated users with ownership or membership checks.
- Parents can only see their linked children's data.
- Students can only see their own data.
- Teachers can only see data for classes they're assigned to.
- Admins can see all data within their school.
*/

-- ============================================================
-- SCHOOLS
-- ============================================================
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text,
  phone text,
  email text,
  logo_url text,
  motto text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  photo_url text,
  bio text,
  qualification text,
  preferred_channel text DEFAULT 'email' CHECK (preferred_channel IN ('sms', 'email', 'push', 'whatsapp')),
  is_active boolean DEFAULT true,
  two_factor_enabled boolean DEFAULT false,
  pin_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL,
  arm text DEFAULT 'A',
  stream text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLASS_SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_core boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACADEMIC SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  term text NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TEACHER ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, class_id, subject_id)
);

ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STUDENT ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  admission_number text,
  parent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLASSROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text,
  file_type text,
  external_url text,
  topic text,
  week integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- LIVE CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meeting_url text,
  recording_url text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('quiz', 'test', 'exam')),
  total_marks numeric DEFAULT 100,
  ca_weight numeric DEFAULT 40,
  exam_weight numeric DEFAULT 60,
  duration_minutes integer,
  max_attempts integer DEFAULT 1,
  randomize_questions boolean DEFAULT false,
  open_at timestamptz,
  close_at timestamptz,
  is_combined boolean DEFAULT false,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- QUESTIONS (question bank)
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay')),
  options jsonb,
  correct_answer text,
  marks numeric DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSESSMENT_QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSESSMENT SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  score numeric,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANSWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  file_url text,
  is_correct boolean,
  marks_awarded numeric DEFAULT 0,
  teacher_comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRADEBOOK
-- ============================================================
CREATE TABLE IF NOT EXISTS gradebook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  ca_score numeric DEFAULT 0,
  exam_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  grade text,
  teacher_remark text,
  is_released boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gradebook ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  target_class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  is_school_wide boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FEES
-- ============================================================
CREATE TABLE IF NOT EXISTS fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  due_date date,
  fee_type text DEFAULT 'term' CHECK (fee_type IN ('term', 'holiday', 'programme')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fee_id uuid NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paystack_reference text UNIQUE,
  paystack_access_code text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  channel text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'email', 'push', 'whatsapp')),
  is_read boolean DEFAULT false,
  related_type text,
  related_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  criteria jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STUDENT BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(student_id, badge_id)
);

ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FORUMS
-- ============================================================
CREATE TABLE IF NOT EXISTS forums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forums ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FORUM POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  parent_post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  is_flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type text CHECK (event_type IN ('live_class', 'assessment', 'homework', 'school_event', 'holiday')),
  start_at timestamptz,
  end_at timestamptz,
  target_class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HOLIDAY PROGRAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS holiday_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  fee_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE holiday_programs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HOLIDAY REGISTRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS holiday_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES holiday_programs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, student_id)
);

ALTER TABLE holiday_registrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DEVICE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name text,
  device_type text,
  ip_address text,
  last_active timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RESOURCE BANK
-- ============================================================
CREATE TABLE IF NOT EXISTS resource_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic text,
  resource_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resource_bank ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_id ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_parent ON student_enrollments(parent_id);
CREATE INDEX IF NOT EXISTS idx_materials_classroom ON materials(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assessments_classroom ON assessments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assessment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_student ON gradebook(student_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_subject ON gradebook(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id);
