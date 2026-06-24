import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  AttendanceSettings,
  AttendanceStatus,
  DutyScheduleEntry,
  DutyTransferRequest,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  SundayAttendanceRecord,
  StudentAttendanceSummary,
  User,
  Course,
  CourseStudent,
} from '../types/lms';
import {
  sortByFirstName,
  getWeekEnd,
  dateToString,
  getCurrentWeekStart,
  generateDutyRotation,
  getWeeksBetween,
  calculateClassScore,
  calculateSaturdayScore,
  calculateTheWellScore,
  calculateSundayScore,
  calculateOverallScore,
} from '../utils/attendanceUtils';

type SupabaseProfileJoin = { id: string; name: string } | { id: string; name: string }[] | null;

function profileName(profile: SupabaseProfileJoin | undefined): string {
  if (!profile) return 'Unknown';
  if (Array.isArray(profile)) return profile[0]?.name ?? 'Unknown';
  return profile.name ?? 'Unknown';
}

type AttendanceSettingsRow = {
  late_class_weight: number;
  late_saturday_weight: number;
  graduation_threshold: number;
  the_well_required_per_month: number;
  sunday_required_per_month: number;
};

export function useAttendance(
  currentUser: User,
  courses: Course[],
  courseStudents: CourseStudent[],
  users: User[]
) {
  const [settings, setSettings] = useState<AttendanceSettings>({
    lateClassWeight: 0.5,
    lateSaturdayWeight: 0.25,
    graduationThreshold: 0.80,
    theWellRequiredPerMonth: 2,
    sundayRequiredPerMonth: 2,
  });
  const [dutySchedule, setDutySchedule] = useState<DutyScheduleEntry[]>([]);
  const [transferRequests, setTransferRequests] =
    useState<DutyTransferRequest[]>([]);
  const [classAttendance, setClassAttendance] =
    useState<ClassAttendanceRecord[]>([]);
  const [theWellAttendance, setTheWellAttendance] =
    useState<TheWellAttendanceRecord[]>([]);
  const [sundayAttendance, setSundayAttendance] =
    useState<SundayAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FETCH ALL ATTENDANCE DATA
  // ============================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, dutyRes, transferRes,
        classAttRes, wellRes, sundayRes] = await Promise.all([
        supabase.from('attendance_settings').select('*').single(),
        supabase.from('duty_schedule').select(`
          id, course_id, student_id, week_start, week_end, status,
          student:profiles!student_id(id, name)
        `).order('week_start', { ascending: true }),
        supabase.from('duty_transfer_requests').select(`
          id, duty_schedule_id, from_student_id, to_student_id,
          course_id, week_start, reason, status, requested_at,
          resolved_at, resolved_by,
          from_student:profiles!from_student_id(id, name),
          to_student:profiles!to_student_id(id, name)
        `).order('requested_at', { ascending: false }),
        supabase.from('class_attendance').select(`
          id, class_id, student_id, status, marked_by, marked_at,
          student:profiles!student_id(id, name)
        `),
        supabase.from('the_well_attendance').select('*'),
        supabase.from('sunday_attendance').select('*'),
      ]);

      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
        throw settingsRes.error;
      }
      if (dutyRes.error) throw dutyRes.error;
      if (transferRes.error) throw transferRes.error;
      if (classAttRes.error) throw classAttRes.error;
      if (wellRes.error) throw wellRes.error;
      if (sundayRes.error) throw sundayRes.error;

      if (settingsRes.data) {
        const row = settingsRes.data as AttendanceSettingsRow;
        setSettings({
          lateClassWeight: row.late_class_weight,
          lateSaturdayWeight: row.late_saturday_weight,
          graduationThreshold: row.graduation_threshold,
          theWellRequiredPerMonth: row.the_well_required_per_month,
          sundayRequiredPerMonth: row.sunday_required_per_month,
        });
      }

      setDutySchedule((dutyRes.data ?? []).map(row => ({
        id: row.id,
        courseId: row.course_id,
        studentId: row.student_id,
        studentName: profileName(row.student),
        weekStart: row.week_start,
        weekEnd: row.week_end,
        status: row.status,
      })));

      setTransferRequests((transferRes.data ?? []).map(row => ({
        id: row.id,
        dutyScheduleId: row.duty_schedule_id,
        fromStudentId: row.from_student_id,
        fromStudentName: profileName(row.from_student),
        toStudentId: row.to_student_id,
        toStudentName: profileName(row.to_student),
        courseId: row.course_id,
        weekStart: row.week_start,
        reason: row.reason,
        status: row.status,
        requestedAt: row.requested_at,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
      })));

      setClassAttendance((classAttRes.data ?? []).map(row => ({
        id: row.id,
        classId: row.class_id,
        studentId: row.student_id,
        studentName: profileName(row.student),
        status: row.status,
        markedBy: row.marked_by,
        markedAt: row.marked_at,
      })));

      setTheWellAttendance((wellRes.data ?? []).map(row => ({
        id: row.id,
        studentId: row.student_id,
        courseId: row.course_id,
        year: row.year,
        month: row.month,
        timesAttended: row.times_attended,
        markedBy: row.marked_by,
        updatedAt: row.updated_at,
      })));

      setSundayAttendance((sundayRes.data ?? []).map(row => ({
        id: row.id,
        studentId: row.student_id,
        courseId: row.course_id,
        year: row.year,
        month: row.month,
        timesServed: row.times_served,
        markedBy: row.marked_by,
        updatedAt: row.updated_at,
      })));
    } catch (err) {
      setError('Failed to load attendance data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ============================================
  // DERIVED: CURRENT DUTY (this week)
  // ============================================
  const currentWeekStart = getCurrentWeekStart();
  const currentDuty = dutySchedule.filter(
    d => d.weekStart === currentWeekStart && d.status === 'active'
  );

  const myCurrentDuty = currentDuty.find(
    d => d.studentId === currentUser.id
  );
  const isOnDuty = !!myCurrentDuty;

  // ============================================
  // DERIVED: PENDING TRANSFER REQUESTS (for admins)
  // ============================================
  const pendingTransferRequests = transferRequests.filter(
    r => r.status === 'pending'
  );

  // ============================================
  // DUTY SCHEDULE MANAGEMENT
  // ============================================
  const generateDutyScheduleForCourse = async (
    courseId: number, startFromStudentIndex: number = 0
  ): Promise<void> => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const enrolledStudentIds = courseStudents
      .filter(cs => cs.courseId === courseId)
      .map(cs => cs.studentId);

    const enrolledUsers = users.filter(u =>
      enrolledStudentIds.includes(u.id) && u.roles.includes('student')
    );

    const sortedStudents = sortByFirstName(enrolledUsers);
    const weeks = getWeeksBetween(course.startDate, course.endDate);
    const rotation = generateDutyRotation(
      sortedStudents.map(s => s.id),
      weeks,
      startFromStudentIndex
    );

    const rows = rotation.map(r => ({
      course_id: courseId,
      student_id: r.studentId,
      week_start: r.weekStart,
      week_end: dateToString(getWeekEnd(new Date(r.weekStart))),
      status: 'active',
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const { error: upsertError } = await supabase.from('duty_schedule')
        .upsert(rows.slice(i, i + 50), { onConflict: 'course_id,week_start' });
      if (upsertError) throw upsertError;
    }

    await fetchAll();
  };

  const updateDutyAssignment = async (
    entryId: number, newStudentId: string
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from('duty_schedule')
      .update({ student_id: newStudentId })
      .eq('id', entryId);
    if (updateError) throw updateError;
    await fetchAll();
  };

  // ============================================
  // TRANSFER REQUESTS
  // ============================================
  const requestDutyTransfer = async (params: {
    dutyScheduleId: number;
    toStudentId: string;
    reason?: string;
  }): Promise<void> => {
    const duty = dutySchedule.find(d => d.id === params.dutyScheduleId);
    if (!duty) return;
    const { error: insertError } = await supabase.from('duty_transfer_requests').insert({
      duty_schedule_id: params.dutyScheduleId,
      from_student_id: currentUser.id,
      to_student_id: params.toStudentId,
      course_id: duty.courseId,
      week_start: duty.weekStart,
      reason: params.reason ?? null,
    });
    if (insertError) throw insertError;
    await fetchAll();
  };

  const resolveTransferRequest = async (
    requestId: number,
    approved: boolean
  ): Promise<void> => {
    const request = transferRequests.find(r => r.id === requestId);
    if (!request) return;

    const { error: updateError } = await supabase
      .from('duty_transfer_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: currentUser.id,
      })
      .eq('id', requestId);
    if (updateError) throw updateError;

    if (approved) {
      const { error: dutyError } = await supabase.from('duty_schedule')
        .update({
          student_id: request.toStudentId,
          status: 'transferred',
        })
        .eq('id', request.dutyScheduleId);
      if (dutyError) throw dutyError;
    }

    await fetchAll();
  };

  // ============================================
  // MARKING ATTENDANCE
  // ============================================
  const markClassAttendance = async (
    classId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ): Promise<void> => {
    const rows = records.map(r => ({
      class_id: classId,
      student_id: r.studentId,
      status: r.status,
      marked_by: currentUser.id,
      marked_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('class_attendance')
      .upsert(rows, { onConflict: 'class_id,student_id' });
    if (upsertError) throw upsertError;
    await fetchAll();
  };

  const upsertTheWellAttendance = async (
    studentId: string, courseId: number,
    year: number, month: number, timesAttended: number
  ): Promise<void> => {
    const { error: upsertError } = await supabase
      .from('the_well_attendance')
      .upsert({
        student_id: studentId, course_id: courseId,
        year, month, times_attended: timesAttended,
        marked_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_id,year,month' });
    if (upsertError) throw upsertError;
    await fetchAll();
  };

  const upsertSundayAttendance = async (
    studentId: string, courseId: number,
    year: number, month: number, timesServed: number
  ): Promise<void> => {
    const { error: upsertError } = await supabase
      .from('sunday_attendance')
      .upsert({
        student_id: studentId, course_id: courseId,
        year, month, times_served: timesServed,
        marked_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_id,year,month' });
    if (upsertError) throw upsertError;
    await fetchAll();
  };

  // ============================================
  // SETTINGS UPDATE
  // ============================================
  const updateSettings = async (
    newSettings: Partial<AttendanceSettings>
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from('attendance_settings')
      .update({
        late_class_weight: newSettings.lateClassWeight ?? settings.lateClassWeight,
        late_saturday_weight: newSettings.lateSaturdayWeight ?? settings.lateSaturdayWeight,
        graduation_threshold: newSettings.graduationThreshold ?? settings.graduationThreshold,
        the_well_required_per_month: newSettings.theWellRequiredPerMonth ?? settings.theWellRequiredPerMonth,
        sunday_required_per_month: newSettings.sundayRequiredPerMonth ?? settings.sundayRequiredPerMonth,
      })
      .eq('id', 1);
    if (updateError) throw updateError;
    await fetchAll();
  };

  // ============================================
  // COMPUTED: STUDENT ATTENDANCE SUMMARIES
  // ============================================
  const getCourseSummaries = useCallback((courseId: number): StudentAttendanceSummary[] => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return [];

    const enrolledIds = courseStudents
      .filter(cs => cs.courseId === courseId)
      .map(cs => cs.studentId);

    const regularClasses = course.subjects.flatMap(s =>
      s.classes.filter(c => c.date && c.hour !== 'both')
    );
    const saturdayClasses = course.subjects.flatMap(s =>
      s.classes.filter(c => c.date && c.hour === 'both')
    );

    return enrolledIds.map(studentId => {
      const student = users.find(u => u.id === studentId);
      if (!student) return null;

      const myClassAtt = classAttendance.filter(
        a => a.studentId === studentId &&
          regularClasses.some(c => c.id === a.classId)
      );
      const mySatAtt = classAttendance.filter(
        a => a.studentId === studentId &&
          saturdayClasses.some(c => c.id === a.classId)
      );
      const myWell = theWellAttendance.filter(
        a => a.studentId === studentId && a.courseId === courseId
      );
      const mySunday = sundayAttendance.filter(
        a => a.studentId === studentId && a.courseId === courseId
      );

      const classScore = calculateClassScore(
        myClassAtt, regularClasses.length, settings
      );
      const satScore = calculateSaturdayScore(
        mySatAtt, saturdayClasses.length, settings
      );
      const wellScore = calculateTheWellScore(myWell, settings);
      const sunScore = calculateSundayScore(mySunday, settings);
      const overall = calculateOverallScore(
        classScore, satScore, wellScore, sunScore
      );

      return {
        studentId,
        studentName: student.name,
        totalClasses: regularClasses.length,
        classesPresent: myClassAtt.filter(a => a.status === 'present').length,
        classesLate: myClassAtt.filter(a => a.status === 'late').length,
        classesAbsent: myClassAtt.filter(a => a.status === 'absent').length,
        classAttendanceScore: classScore,
        totalSaturdays: saturdayClasses.length,
        saturdaysPresent: mySatAtt.filter(a => a.status === 'present').length,
        saturdaysLate: mySatAtt.filter(a => a.status === 'late').length,
        saturdaysAbsent: mySatAtt.filter(a => a.status === 'absent').length,
        saturdayAttendanceScore: satScore,
        theWellMonthsTracked: myWell.length,
        theWellScore: wellScore,
        sundayMonthsTracked: mySunday.length,
        sundayScore: sunScore,
        overallScore: overall,
        meetsGraduationThreshold: overall >= settings.graduationThreshold,
      };
    }).filter((s): s is StudentAttendanceSummary => s !== null);
  }, [courses, courseStudents, users, classAttendance,
    theWellAttendance, sundayAttendance, settings]);

  return {
    settings, dutySchedule, transferRequests,
    classAttendance, theWellAttendance, sundayAttendance,
    loading, error,
    currentDuty, myCurrentDuty, isOnDuty,
    pendingTransferRequests,
    generateDutyScheduleForCourse, updateDutyAssignment,
    requestDutyTransfer, resolveTransferRequest,
    markClassAttendance, upsertTheWellAttendance,
    upsertSundayAttendance, updateSettings,
    getCourseSummaries,
    refetch: fetchAll,
  };
}
