/*
# Durable Schools — RLS Policies

## Overview
Enables row-level security policies on all tables. The platform is multi-tenant:
each user belongs to a school and has a role (admin, teacher, student, parent).
Access is governed by school membership and role-specific ownership rules.

## Security Model
- Admin: full access to all data within their school
- Teacher: access to data for classes/subjects they are assigned to
- Student: access to their own data only
- Parent: access to their linked children's data (read-only + messaging)

## Helper Functions
- get_user_school_id(): returns the school_id of the current authenticated user
- get_user_role(): returns the role of the current authenticated user
- is_school_admin(): returns true if the current user is an admin of the given school
- is_teacher_of_class(): returns true if the current user teaches the given class
- is_student_in_class(): returns true if the current user is enrolled in the given class
- is_parent_of_student(): returns true if the current user is the parent of the given student
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_school_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND school_id = p_school_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_teacher_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN profiles p ON p.id = ta.teacher_id
    WHERE ta.teacher_id = auth.uid() AND ta.class_id = p_class_id AND ta.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION is_student_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_enrollments
    WHERE student_id = auth.uid() AND class_id = p_class_id
  );
$$;

CREATE OR REPLACE FUNCTION is_parent_of_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_enrollments
    WHERE parent_id = auth.uid() AND student_id = p_student_id
  );
$$;

-- ============================================================
-- SCHOOLS
-- ============================================================
DROP POLICY IF EXISTS "schools_read" ON schools;
CREATE POLICY "schools_read" ON schools FOR SELECT
  TO authenticated USING (
    id = get_user_school_id()
  );

DROP POLICY IF EXISTS "schools_update" ON schools;
CREATE POLICY "schools_update" ON schools FOR UPDATE
  TO authenticated USING (is_school_admin(id))
  WITH CHECK (is_school_admin(id));

-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_read" ON profiles;
CREATE POLICY "profiles_read" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  TO authenticated USING (
    id = auth.uid()
    OR is_school_admin(school_id)
  )
  WITH CHECK (
    id = auth.uid()
    OR is_school_admin(school_id)
  );

-- ============================================================
-- CLASSES
-- ============================================================
DROP POLICY IF EXISTS "classes_read" ON classes;
CREATE POLICY "classes_read" ON classes FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "classes_write" ON classes;
CREATE POLICY "classes_write" ON classes FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- SUBJECTS
-- ============================================================
DROP POLICY IF EXISTS "subjects_read" ON subjects;
CREATE POLICY "subjects_read" ON subjects FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "subjects_write" ON subjects;
CREATE POLICY "subjects_write" ON subjects FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- CLASS_SUBJECTS
-- ============================================================
DROP POLICY IF EXISTS "class_subjects_read" ON class_subjects;
CREATE POLICY "class_subjects_read" ON class_subjects FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_subjects.class_id AND c.school_id = get_user_school_id()
    )
  );

DROP POLICY IF EXISTS "class_subjects_write" ON class_subjects;
CREATE POLICY "class_subjects_write" ON class_subjects FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_subjects.class_id AND is_school_admin(c.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_subjects.class_id AND is_school_admin(c.school_id)
    )
  );

-- ============================================================
-- ACADEMIC SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "sessions_read" ON academic_sessions;
CREATE POLICY "sessions_read" ON academic_sessions FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "sessions_write" ON academic_sessions;
CREATE POLICY "sessions_write" ON academic_sessions FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- TEACHER ASSIGNMENTS
-- ============================================================
DROP POLICY IF EXISTS "teacher_assignments_read" ON teacher_assignments;
CREATE POLICY "teacher_assignments_read" ON teacher_assignments FOR SELECT
  TO authenticated USING (
    teacher_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = teacher_assignments.class_id)
    )
    OR is_teacher_of_class(class_id)
  );

DROP POLICY IF EXISTS "teacher_assignments_insert" ON teacher_assignments;
CREATE POLICY "teacher_assignments_insert" ON teacher_assignments FOR INSERT
  TO authenticated WITH CHECK (
    teacher_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = teacher_assignments.class_id)
    )
  );

DROP POLICY IF EXISTS "teacher_assignments_update" ON teacher_assignments;
CREATE POLICY "teacher_assignments_update" ON teacher_assignments FOR UPDATE
  TO authenticated USING (
    teacher_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = teacher_assignments.class_id)
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = teacher_assignments.class_id)
    )
  );

DROP POLICY IF EXISTS "teacher_assignments_delete" ON teacher_assignments;
CREATE POLICY "teacher_assignments_delete" ON teacher_assignments FOR DELETE
  TO authenticated USING (
    is_school_admin(
      (SELECT school_id FROM classes WHERE id = teacher_assignments.class_id)
    )
  );

-- ============================================================
-- STUDENT ENROLLMENTS
-- ============================================================
DROP POLICY IF EXISTS "enrollments_read" ON student_enrollments;
CREATE POLICY "enrollments_read" ON student_enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR parent_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = student_enrollments.class_id)
    )
    OR is_teacher_of_class(class_id)
  );

DROP POLICY IF EXISTS "enrollments_write" ON student_enrollments;
CREATE POLICY "enrollments_write" ON student_enrollments FOR ALL
  TO authenticated USING (
    is_school_admin(
      (SELECT school_id FROM classes WHERE id = student_enrollments.class_id)
    )
  )
  WITH CHECK (
    is_school_admin(
      (SELECT school_id FROM classes WHERE id = student_enrollments.class_id)
    )
  );

-- ============================================================
-- CLASSROOMS
-- ============================================================
DROP POLICY IF EXISTS "classrooms_read" ON classrooms;
CREATE POLICY "classrooms_read" ON classrooms FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
    AND (
      teacher_id = auth.uid()
      OR get_user_role() = 'admin'
      OR is_student_in_class(class_id)
    )
  );

DROP POLICY IF EXISTS "classrooms_write" ON classrooms;
CREATE POLICY "classrooms_write" ON classrooms FOR ALL
  TO authenticated USING (
    teacher_id = auth.uid()
    OR is_school_admin(school_id)
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR is_school_admin(school_id)
  );

-- ============================================================
-- MATERIALS
-- ============================================================
DROP POLICY IF EXISTS "materials_read" ON materials;
CREATE POLICY "materials_read" ON materials FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = materials.classroom_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "materials_write" ON materials;
CREATE POLICY "materials_write" ON materials FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = materials.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = materials.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- LIVE CLASSES
-- ============================================================
DROP POLICY IF EXISTS "live_classes_read" ON live_classes;
CREATE POLICY "live_classes_read" ON live_classes FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = live_classes.classroom_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "live_classes_write" ON live_classes;
CREATE POLICY "live_classes_write" ON live_classes FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = live_classes.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = live_classes.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- ASSESSMENTS
-- ============================================================
DROP POLICY IF EXISTS "assessments_read" ON assessments;
CREATE POLICY "assessments_read" ON assessments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = assessments.classroom_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "assessments_write" ON assessments;
CREATE POLICY "assessments_write" ON assessments FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = assessments.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = assessments.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- QUESTIONS
-- ============================================================
DROP POLICY IF EXISTS "questions_read" ON questions;
CREATE POLICY "questions_read" ON questions FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "questions_write" ON questions;
CREATE POLICY "questions_write" ON questions FOR ALL
  TO authenticated USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('admin', 'teacher')
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('admin', 'teacher')
  );

-- ============================================================
-- ASSESSMENT QUESTIONS
-- ============================================================
DROP POLICY IF EXISTS "assessment_questions_read" ON assessment_questions;
CREATE POLICY "assessment_questions_read" ON assessment_questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_questions.assessment_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "assessment_questions_write" ON assessment_questions;
CREATE POLICY "assessment_questions_write" ON assessment_questions FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_questions.assessment_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_questions.assessment_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- ASSESSMENT SUBMISSIONS
-- ============================================================
DROP POLICY IF EXISTS "submissions_read" ON assessment_submissions;
CREATE POLICY "submissions_read" ON assessment_submissions FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_submissions.assessment_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

DROP POLICY IF EXISTS "submissions_insert" ON assessment_submissions;
CREATE POLICY "submissions_insert" ON assessment_submissions FOR INSERT
  TO authenticated WITH CHECK (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "submissions_update" ON assessment_submissions;
CREATE POLICY "submissions_update" ON assessment_submissions FOR UPDATE
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_submissions.assessment_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assessments a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = assessment_submissions.assessment_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- ANSWERS
-- ============================================================
DROP POLICY IF EXISTS "answers_read" ON answers;
CREATE POLICY "answers_read" ON answers FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assessment_submissions s
      WHERE s.id = answers.submission_id
      AND (
        s.student_id = auth.uid()
        OR is_parent_of_student(s.student_id)
        OR EXISTS (
          SELECT 1 FROM assessments a
          JOIN classrooms c ON c.id = a.classroom_id
          WHERE a.id = s.assessment_id
          AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
        )
      )
    )
  );

DROP POLICY IF EXISTS "answers_insert" ON answers;
CREATE POLICY "answers_insert" ON answers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessment_submissions s
      WHERE s.id = answers.submission_id AND s.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "answers_update" ON answers;
CREATE POLICY "answers_update" ON answers FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assessment_submissions s
      JOIN assessments a ON a.id = s.assessment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE s.id = answers.submission_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessment_submissions s
      JOIN assessments a ON a.id = s.assessment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE s.id = answers.submission_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- GRADEBOOK
-- ============================================================
DROP POLICY IF EXISTS "gradebook_read" ON gradebook;
CREATE POLICY "gradebook_read" ON gradebook FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = gradebook.class_id)
    )
  );

DROP POLICY IF EXISTS "gradebook_write" ON gradebook;
CREATE POLICY "gradebook_write" ON gradebook FOR ALL
  TO authenticated USING (
    is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = gradebook.class_id)
    )
  )
  WITH CHECK (
    is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = gradebook.class_id)
    )
  );

-- ============================================================
-- ATTENDANCE
-- ============================================================
DROP POLICY IF EXISTS "attendance_read" ON attendance;
CREATE POLICY "attendance_read" ON attendance FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = attendance.class_id)
    )
  );

DROP POLICY IF EXISTS "attendance_write" ON attendance;
CREATE POLICY "attendance_write" ON attendance FOR ALL
  TO authenticated USING (
    is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = attendance.class_id)
    )
  )
  WITH CHECK (
    is_teacher_of_class(class_id)
    OR is_school_admin(
      (SELECT school_id FROM classes WHERE id = attendance.class_id)
    )
  );

-- ============================================================
-- MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "messages_read" ON messages;
CREATE POLICY "messages_read" ON messages FOR SELECT
  TO authenticated USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE
  TO authenticated USING (
    receiver_id = auth.uid()
  )
  WITH CHECK (
    receiver_id = auth.uid()
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
DROP POLICY IF EXISTS "announcements_read" ON announcements;
CREATE POLICY "announcements_read" ON announcements FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "announcements_write" ON announcements;
CREATE POLICY "announcements_write" ON announcements FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
    OR (
      get_user_role() = 'teacher'
      AND target_class_id IS NOT NULL
      AND is_teacher_of_class(target_class_id)
    )
  )
  WITH CHECK (
    is_school_admin(school_id)
    OR (
      get_user_role() = 'teacher'
      AND target_class_id IS NOT NULL
      AND is_teacher_of_class(target_class_id)
    )
  );

-- ============================================================
-- FEES
-- ============================================================
DROP POLICY IF EXISTS "fees_read" ON fees;
CREATE POLICY "fees_read" ON fees FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "fees_write" ON fees;
CREATE POLICY "fees_write" ON fees FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- INVOICES
-- ============================================================
DROP POLICY IF EXISTS "invoices_read" ON invoices;
CREATE POLICY "invoices_read" ON invoices FOR SELECT
  TO authenticated USING (
    is_parent_of_student(student_id)
    OR student_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM profiles WHERE id = invoices.student_id)
    )
  );

DROP POLICY IF EXISTS "invoices_write" ON invoices;
CREATE POLICY "invoices_write" ON invoices FOR ALL
  TO authenticated USING (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = invoices.student_id)
    )
  )
  WITH CHECK (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = invoices.student_id)
    )
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
DROP POLICY IF EXISTS "payments_read" ON payments;
CREATE POLICY "payments_read" ON payments FOR SELECT
  TO authenticated USING (
    is_parent_of_student(student_id)
    OR student_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM profiles WHERE id = payments.student_id)
    )
  );

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (
    is_parent_of_student(student_id)
    OR student_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM profiles WHERE id = payments.student_id)
    )
  );

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated USING (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = payments.student_id)
    )
  )
  WITH CHECK (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = payments.student_id)
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "notifications_read" ON notifications;
CREATE POLICY "notifications_read" ON notifications FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR is_school_admin(
      (SELECT school_id FROM profiles WHERE id = notifications.user_id)
    )
  );

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================
-- BADGES
-- ============================================================
DROP POLICY IF EXISTS "badges_read" ON badges;
CREATE POLICY "badges_read" ON badges FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "badges_write" ON badges;
CREATE POLICY "badges_write" ON badges FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- STUDENT BADGES
-- ============================================================
DROP POLICY IF EXISTS "student_badges_read" ON student_badges;
CREATE POLICY "student_badges_read" ON student_badges FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_school_admin(
      (SELECT school_id FROM profiles WHERE id = student_badges.student_id)
    )
  );

DROP POLICY IF EXISTS "student_badges_write" ON student_badges;
CREATE POLICY "student_badges_write" ON student_badges FOR ALL
  TO authenticated USING (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = student_badges.student_id)
    )
  )
  WITH CHECK (
    is_school_admin(
      (SELECT school_id FROM profiles WHERE id = student_badges.student_id)
    )
  );

-- ============================================================
-- FORUMS
-- ============================================================
DROP POLICY IF EXISTS "forums_read" ON forums;
CREATE POLICY "forums_read" ON forums FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = forums.classroom_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "forums_write" ON forums;
CREATE POLICY "forums_write" ON forums FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = forums.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = forums.classroom_id
      AND (c.teacher_id = auth.uid() OR is_school_admin(c.school_id))
    )
  );

-- ============================================================
-- FORUM POSTS
-- ============================================================
DROP POLICY IF EXISTS "forum_posts_read" ON forum_posts;
CREATE POLICY "forum_posts_read" ON forum_posts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM forums f
      JOIN classrooms c ON c.id = f.classroom_id
      WHERE f.id = forum_posts.forum_id
      AND (
        c.teacher_id = auth.uid()
        OR get_user_role() = 'admin'
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "forum_posts_insert" ON forum_posts;
CREATE POLICY "forum_posts_insert" ON forum_posts FOR INSERT
  TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM forums f
      JOIN classrooms c ON c.id = f.classroom_id
      WHERE f.id = forum_posts.forum_id
      AND (
        c.teacher_id = auth.uid()
        OR is_student_in_class(c.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "forum_posts_update" ON forum_posts;
CREATE POLICY "forum_posts_update" ON forum_posts FOR UPDATE
  TO authenticated USING (
    author_id = auth.uid()
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    author_id = auth.uid()
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "forum_posts_delete" ON forum_posts;
CREATE POLICY "forum_posts_delete" ON forum_posts FOR DELETE
  TO authenticated USING (
    author_id = auth.uid()
    OR get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM forums f
      JOIN classrooms c ON c.id = f.classroom_id
      WHERE f.id = forum_posts.forum_id AND c.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
DROP POLICY IF EXISTS "calendar_events_read" ON calendar_events;
CREATE POLICY "calendar_events_read" ON calendar_events FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "calendar_events_write" ON calendar_events;
CREATE POLICY "calendar_events_write" ON calendar_events FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
    OR get_user_role() = 'teacher'
  )
  WITH CHECK (
    is_school_admin(school_id)
    OR get_user_role() = 'teacher'
  );

-- ============================================================
-- AUDIT LOGS
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_read" ON audit_logs;
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT
  TO authenticated USING (
    is_school_admin(school_id)
  );

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    is_school_admin(school_id)
    OR actor_id = auth.uid()
  );

-- ============================================================
-- HOLIDAY PROGRAMS
-- ============================================================
DROP POLICY IF EXISTS "holiday_programs_read" ON holiday_programs;
CREATE POLICY "holiday_programs_read" ON holiday_programs FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "holiday_programs_write" ON holiday_programs;
CREATE POLICY "holiday_programs_write" ON holiday_programs FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
  )
  WITH CHECK (
    is_school_admin(school_id)
  );

-- ============================================================
-- HOLIDAY REGISTRATIONS
-- ============================================================
DROP POLICY IF EXISTS "holiday_reg_read" ON holiday_registrations;
CREATE POLICY "holiday_reg_read" ON holiday_registrations FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_school_admin(
      (SELECT school_id FROM holiday_programs WHERE id = holiday_registrations.program_id)
    )
  );

DROP POLICY IF EXISTS "holiday_reg_write" ON holiday_registrations;
CREATE POLICY "holiday_reg_write" ON holiday_registrations FOR ALL
  TO authenticated USING (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_school_admin(
      (SELECT school_id FROM holiday_programs WHERE id = holiday_registrations.program_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR is_parent_of_student(student_id)
    OR is_school_admin(
      (SELECT school_id FROM holiday_programs WHERE id = holiday_registrations.program_id)
    )
  );

-- ============================================================
-- DEVICE SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "device_sessions_read" ON device_sessions;
CREATE POLICY "device_sessions_read" ON device_sessions FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "device_sessions_insert" ON device_sessions;
CREATE POLICY "device_sessions_insert" ON device_sessions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "device_sessions_delete" ON device_sessions;
CREATE POLICY "device_sessions_delete" ON device_sessions FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
  );

-- ============================================================
-- RESOURCE BANK
-- ============================================================
DROP POLICY IF EXISTS "resource_bank_read" ON resource_bank;
CREATE POLICY "resource_bank_read" ON resource_bank FOR SELECT
  TO authenticated USING (
    school_id = get_user_school_id()
  );

DROP POLICY IF EXISTS "resource_bank_write" ON resource_bank;
CREATE POLICY "resource_bank_write" ON resource_bank FOR ALL
  TO authenticated USING (
    is_school_admin(school_id)
    OR get_user_role() = 'teacher'
  )
  WITH CHECK (
    is_school_admin(school_id)
    OR get_user_role() = 'teacher'
  );
