import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  AttendanceSettings,
  AttendanceStatus,
  DutyScheduleEntry,
  PrayerScheduleEntry,
  PrayerScheduleGenerateOptions,
  WellScheduleEntry,
  DutyTransferRequest,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  TheWellSessionRecord,
  SundayAttendanceRecord,
  StudentAttendanceSummary,
  MinistryTeam,
  MinistryTeamMember,
  MinistryRotation,
  MinistryServiceSession,
  MinistryServiceAttendanceRecord,
  AttendanceGateSummary,
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
  generatePrayerSchedule,
  getSchoolYearWeeks,
  getWellDateForWeek,
  getWeeksBetween,
  calculateClassScore,
  calculateSaturdayScore,
  calculateTheWellScore,
  calculateSundayScore,
  calculateOverallScore,
  calculateAttendanceCredits,
  aggregateWellSessionsForMonth,
  getYearMonthFromWeekStart,
  isActivationSaturdayClass,
} from '../utils/attendanceUtils';
import { isCourseActive } from '../utils/courseUtils';

type SupabaseProfileJoin =
  | { id: string; name: string; email?: string | null; avatar_url?: string | null }
  | { id: string; name: string; email?: string | null; avatar_url?: string | null }[]
  | null;

function profileName(profile: SupabaseProfileJoin | undefined): string {
  if (!profile) return 'Unknown';
  if (Array.isArray(profile)) return profile[0]?.name ?? 'Unknown';
  return profile.name ?? 'Unknown';
}

function profileValue(profile: SupabaseProfileJoin | undefined) {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

type AttendanceSettingsRow = {
  [key: string]: unknown;
};

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  presentCredit: 1,
  lateCredit: 0.5,
  absentCredit: 0,
  lateUsesGlobalCredit: true,
  lateClassWeight: 0.5,
  lateSaturdayWeight: 0.5,
  lateWellWeight: 0.5,
  graduationThreshold: 0.8,
  classRequiredPercent: 0.8,
  classIncludedWeekdays: [2, 4],
  classSessionsPerDay: 2,
  classJointCountsOnce: true,
  theWellEnabled: true,
  theWellWeekday: 3,
  theWellRequiredPerMonth: 2,
  theWellFallbackEnabled: true,
  theWellFallbackPercent: 0.5,
  activationEnabled: true,
  activationFrequency: 'monthly',
  activationMaxLostCredits: 1,
  activationDetectionRule: 'saturday_both',
  ministryEnabled: true,
  ministrySundayRequiredCredits: 2,
  ministrySundayPeriodMonths: 1,
  ministryFirstYearRotationMonths: 2,
  ministrySecondYearRotationMonths: 4,
  ministryTeamLeadersCanMark: true,
  ministryAdminsCanOverrideRotations: true,
  statusOnTrackThreshold: 0.9,
  statusAtRiskThreshold: 0.8,
  statusFailingThreshold: 0.8,
  showClassesOnStudentView: true,
  showTheWellOnStudentView: true,
  showActivationOnStudentView: true,
  showMinistryOnStudentView: true,
  showFallbackScores: true,
  remindMissingClassAttendance: true,
  remindMissingWellAttendance: true,
  remindMissingMinistryAttendance: true,
  sundayRequiredPerMonth: 2,
};

function numberSetting(row: AttendanceSettingsRow, key: string, fallback: number): number {
  const value = row[key];
  return typeof value === 'number' ? value : fallback;
}

function booleanSetting(row: AttendanceSettingsRow, key: string, fallback: boolean): boolean {
  const value = row[key];
  return typeof value === 'boolean' ? value : fallback;
}

function arraySetting(row: AttendanceSettingsRow, key: string, fallback: number[]): number[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : fallback;
}

function stringSetting<T extends string>(row: AttendanceSettingsRow, key: string, fallback: T): T {
  const value = row[key];
  return typeof value === 'string' ? value as T : fallback;
}

function mapAttendanceSettings(row: AttendanceSettingsRow): AttendanceSettings {
  const lateCredit = numberSetting(row, 'late_credit', numberSetting(row, 'late_class_weight', DEFAULT_ATTENDANCE_SETTINGS.lateCredit));
  const ministrySundayRequiredCredits = numberSetting(
    row,
    'ministry_sunday_required_credits',
    numberSetting(row, 'sunday_required_per_month', DEFAULT_ATTENDANCE_SETTINGS.ministrySundayRequiredCredits)
  );

  return {
    ...DEFAULT_ATTENDANCE_SETTINGS,
    presentCredit: numberSetting(row, 'present_credit', DEFAULT_ATTENDANCE_SETTINGS.presentCredit),
    lateCredit,
    absentCredit: numberSetting(row, 'absent_credit', DEFAULT_ATTENDANCE_SETTINGS.absentCredit),
    lateUsesGlobalCredit: booleanSetting(row, 'late_uses_global_credit', DEFAULT_ATTENDANCE_SETTINGS.lateUsesGlobalCredit),
    lateClassWeight: lateCredit,
    lateSaturdayWeight: lateCredit,
    lateWellWeight: lateCredit,
    graduationThreshold: numberSetting(row, 'graduation_threshold', DEFAULT_ATTENDANCE_SETTINGS.graduationThreshold),
    classRequiredPercent: numberSetting(row, 'class_required_percent', numberSetting(row, 'graduation_threshold', DEFAULT_ATTENDANCE_SETTINGS.classRequiredPercent)),
    classIncludedWeekdays: arraySetting(row, 'class_included_weekdays', DEFAULT_ATTENDANCE_SETTINGS.classIncludedWeekdays),
    classSessionsPerDay: numberSetting(row, 'class_sessions_per_day', DEFAULT_ATTENDANCE_SETTINGS.classSessionsPerDay),
    classJointCountsOnce: booleanSetting(row, 'class_joint_counts_once', DEFAULT_ATTENDANCE_SETTINGS.classJointCountsOnce),
    theWellEnabled: booleanSetting(row, 'the_well_enabled', DEFAULT_ATTENDANCE_SETTINGS.theWellEnabled),
    theWellWeekday: numberSetting(row, 'the_well_weekday', DEFAULT_ATTENDANCE_SETTINGS.theWellWeekday),
    theWellRequiredPerMonth: numberSetting(row, 'the_well_required_per_month', DEFAULT_ATTENDANCE_SETTINGS.theWellRequiredPerMonth),
    theWellFallbackEnabled: booleanSetting(row, 'the_well_fallback_enabled', DEFAULT_ATTENDANCE_SETTINGS.theWellFallbackEnabled),
    theWellFallbackPercent: numberSetting(row, 'the_well_fallback_percent', DEFAULT_ATTENDANCE_SETTINGS.theWellFallbackPercent),
    activationEnabled: booleanSetting(row, 'activation_enabled', DEFAULT_ATTENDANCE_SETTINGS.activationEnabled),
    activationFrequency: stringSetting(row, 'activation_frequency', DEFAULT_ATTENDANCE_SETTINGS.activationFrequency),
    activationMaxLostCredits: numberSetting(row, 'activation_max_lost_credits', DEFAULT_ATTENDANCE_SETTINGS.activationMaxLostCredits),
    activationDetectionRule: stringSetting(row, 'activation_detection_rule', DEFAULT_ATTENDANCE_SETTINGS.activationDetectionRule),
    ministryEnabled: booleanSetting(row, 'ministry_enabled', DEFAULT_ATTENDANCE_SETTINGS.ministryEnabled),
    ministrySundayRequiredCredits,
    ministrySundayPeriodMonths: numberSetting(row, 'ministry_sunday_period_months', DEFAULT_ATTENDANCE_SETTINGS.ministrySundayPeriodMonths),
    ministryFirstYearRotationMonths: numberSetting(row, 'ministry_first_year_rotation_months', DEFAULT_ATTENDANCE_SETTINGS.ministryFirstYearRotationMonths),
    ministrySecondYearRotationMonths: numberSetting(row, 'ministry_second_year_rotation_months', DEFAULT_ATTENDANCE_SETTINGS.ministrySecondYearRotationMonths),
    ministryTeamLeadersCanMark: booleanSetting(row, 'ministry_team_leaders_can_mark', DEFAULT_ATTENDANCE_SETTINGS.ministryTeamLeadersCanMark),
    ministryAdminsCanOverrideRotations: booleanSetting(row, 'ministry_admins_can_override_rotations', DEFAULT_ATTENDANCE_SETTINGS.ministryAdminsCanOverrideRotations),
    statusOnTrackThreshold: numberSetting(row, 'status_on_track_threshold', DEFAULT_ATTENDANCE_SETTINGS.statusOnTrackThreshold),
    statusAtRiskThreshold: numberSetting(row, 'status_at_risk_threshold', DEFAULT_ATTENDANCE_SETTINGS.statusAtRiskThreshold),
    statusFailingThreshold: numberSetting(row, 'status_failing_threshold', DEFAULT_ATTENDANCE_SETTINGS.statusFailingThreshold),
    showClassesOnStudentView: booleanSetting(row, 'show_classes_on_student_view', DEFAULT_ATTENDANCE_SETTINGS.showClassesOnStudentView),
    showTheWellOnStudentView: booleanSetting(row, 'show_the_well_on_student_view', DEFAULT_ATTENDANCE_SETTINGS.showTheWellOnStudentView),
    showActivationOnStudentView: booleanSetting(row, 'show_activation_on_student_view', DEFAULT_ATTENDANCE_SETTINGS.showActivationOnStudentView),
    showMinistryOnStudentView: booleanSetting(row, 'show_ministry_on_student_view', DEFAULT_ATTENDANCE_SETTINGS.showMinistryOnStudentView),
    showFallbackScores: booleanSetting(row, 'show_fallback_scores', DEFAULT_ATTENDANCE_SETTINGS.showFallbackScores),
    remindMissingClassAttendance: booleanSetting(row, 'remind_missing_class_attendance', DEFAULT_ATTENDANCE_SETTINGS.remindMissingClassAttendance),
    remindMissingWellAttendance: booleanSetting(row, 'remind_missing_well_attendance', DEFAULT_ATTENDANCE_SETTINGS.remindMissingWellAttendance),
    remindMissingMinistryAttendance: booleanSetting(row, 'remind_missing_ministry_attendance', DEFAULT_ATTENDANCE_SETTINGS.remindMissingMinistryAttendance),
    sundayRequiredPerMonth: ministrySundayRequiredCredits,
  };
}

export function useAttendance(
  currentUser: User,
  courses: Course[],
  courseStudents: CourseStudent[],
  users: User[]
) {
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS);
  const [dutySchedule, setDutySchedule] = useState<DutyScheduleEntry[]>([]);
  const [prayerSchedule, setPrayerSchedule] = useState<PrayerScheduleEntry[]>([]);
  const [wellSchedule, setWellSchedule] = useState<WellScheduleEntry[]>([]);
  const [transferRequests, setTransferRequests] =
    useState<DutyTransferRequest[]>([]);
  const [classAttendance, setClassAttendance] =
    useState<ClassAttendanceRecord[]>([]);
  const [theWellAttendance, setTheWellAttendance] =
    useState<TheWellAttendanceRecord[]>([]);
  const [theWellSessionAttendance, setTheWellSessionAttendance] =
    useState<TheWellSessionRecord[]>([]);
  const [sundayAttendance, setSundayAttendance] =
    useState<SundayAttendanceRecord[]>([]);
  const [ministryTeams, setMinistryTeams] = useState<MinistryTeam[]>([]);
  const [ministryRotations, setMinistryRotations] = useState<MinistryRotation[]>([]);
  const [ministrySessions, setMinistrySessions] = useState<MinistryServiceSession[]>([]);
  const [ministryAttendance, setMinistryAttendance] = useState<MinistryServiceAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FETCH ALL ATTENDANCE DATA
  // ============================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, dutyRes, prayerRes, wellScheduleRes, transferRes,
        classAttRes, wellRes, wellSessionRes, sundayRes,
        ministryTeamsRes, ministryMembersRes, ministryRotationsRes, ministrySessionsRes, ministryAttendanceRes] = await Promise.all([
        supabase.from('attendance_settings').select('*').single(),
        supabase.from('duty_schedule').select(`
          id, course_id, student_id, week_start, week_end, status,
          student:profiles!student_id(id, name)
        `).order('week_start', { ascending: true }),
        supabase.from('prayer_schedule').select(`
          id, week_start, week_end, tuesday_student_id, thursday_student_id
        `).order('week_start', { ascending: true }),
        supabase.from('well_schedule').select(`
          id, course_id, week_start, well_date
        `).order('well_date', { ascending: true }),
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
        supabase.from('the_well_session_attendance').select('*'),
        supabase.from('sunday_attendance').select('*'),
        supabase.from('ministry_teams').select(`
          id, name, name_bg, info, leader_id,
          call_time, service_type, service_day, required_credits,
          requirement_period_months, requirement_unit, active, created_at, updated_at,
          leader:profiles!leader_id(id, name)
        `).order('name', { ascending: true }),
        supabase.from('ministry_team_members').select(`
          id, team_id, user_id, role, can_submit_reports, active, created_at, updated_at,
          user:profiles!user_id(id, name, email, phone, avatar_url)
        `).order('created_at', { ascending: true }),
        supabase.from('ministry_rotations').select(`
          id, course_id, student_id, team_id, start_date, end_date,
          status, locked, notes, created_at, updated_at,
          student:profiles!student_id(id, name)
        `).order('start_date', { ascending: true }),
        supabase.from('ministry_service_sessions').select(`
          *,
          creator:profiles!created_by(id, name)
        `).order('service_date', { ascending: false }),
        supabase.from('ministry_service_attendance').select(`
          id, session_id, student_id, status, marked_by, marked_at,
          student:profiles!student_id(id, name)
        `),
      ]);

      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
        throw settingsRes.error;
      }
      if (dutyRes.error) throw dutyRes.error;
      if (prayerRes.error && prayerRes.error.code !== '42P01') throw prayerRes.error;
      if (wellScheduleRes.error && wellScheduleRes.error.code !== '42P01') throw wellScheduleRes.error;
      if (transferRes.error) throw transferRes.error;
      if (classAttRes.error) throw classAttRes.error;
      if (wellRes.error) throw wellRes.error;
      if (wellSessionRes.error) throw wellSessionRes.error;
      if (sundayRes.error) throw sundayRes.error;
      const ministryMissing =
        ministryTeamsRes.error?.code === '42P01' ||
        ministryMembersRes.error?.code === '42P01' ||
        ministryRotationsRes.error?.code === '42P01' ||
        ministrySessionsRes.error?.code === '42P01' ||
        ministryAttendanceRes.error?.code === '42P01';
      if (!ministryMissing) {
        if (ministryTeamsRes.error) throw ministryTeamsRes.error;
        if (ministryMembersRes.error) throw ministryMembersRes.error;
        if (ministryRotationsRes.error) throw ministryRotationsRes.error;
        if (ministrySessionsRes.error) throw ministrySessionsRes.error;
        if (ministryAttendanceRes.error) throw ministryAttendanceRes.error;
      }

      if (settingsRes.data) {
        setSettings(mapAttendanceSettings(settingsRes.data as AttendanceSettingsRow));
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

      setPrayerSchedule((prayerRes.error?.code === '42P01' ? [] : prayerRes.data ?? []).map(row => {
        const tuesdayStudent = users.find(user => user.id === row.tuesday_student_id);
        const thursdayStudent = users.find(user => user.id === row.thursday_student_id);
        return {
          id: row.id,
          weekStart: row.week_start,
          weekEnd: row.week_end,
          tuesdayStudentId: row.tuesday_student_id,
          tuesdayStudentName: tuesdayStudent?.name ?? null,
          thursdayStudentId: row.thursday_student_id,
          thursdayStudentName: thursdayStudent?.name ?? null,
        };
      }));

      setWellSchedule((wellScheduleRes.error?.code === '42P01' ? [] : wellScheduleRes.data ?? []).map(row => ({
        id: row.id,
        courseId: row.course_id,
        weekStart: row.week_start,
        wellDate: row.well_date,
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
        timesLate: row.times_late ?? 0,
        markedBy: row.marked_by,
        updatedAt: row.updated_at,
      })));

      setTheWellSessionAttendance((wellSessionRes.data ?? []).map(row => ({
        id: row.id,
        studentId: row.student_id,
        courseId: row.course_id,
        weekStart: row.week_start,
        status: row.status,
        markedBy: row.marked_by,
        markedAt: row.marked_at,
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

      if (ministryMissing) {
        setMinistryTeams([]);
        setMinistryRotations([]);
        setMinistrySessions([]);
        setMinistryAttendance([]);
      } else {
        const ministryMembers: MinistryTeamMember[] = (ministryMembersRes.data ?? []).map(row => {
          const user = profileValue(row.user);
          return {
            id: row.id,
            teamId: row.team_id,
            userId: row.user_id,
            userName: user?.name ?? 'Unknown user',
            userEmail: user?.email ?? null,
            userPhone: user?.phone ?? null,
            userAvatarUrl: user?.avatar_url ?? null,
            role: row.role,
            canSubmitReports: row.can_submit_reports,
            active: row.active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });

        setMinistryTeams((ministryTeamsRes.data ?? []).map(row => ({
          ...(() => {
            const members = ministryMembers.filter(member => member.teamId === row.id);
            const reportMembers = members.filter(member => member.active && member.canSubmitReports);
            return {
              id: row.id,
              name: row.name,
              nameBg: row.name_bg,
              info: row.info,
              leaderId: row.leader_id,
              leaderName: reportMembers.map(member => member.userName).join(', ') || profileName(row.leader),
              members,
              callTime: row.call_time,
              serviceType: row.service_type,
              serviceDay: row.service_day,
              requiredCredits: row.required_credits,
              requirementPeriodMonths: row.requirement_period_months,
              requirementUnit: row.requirement_unit,
              active: row.active,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            };
          })(),
        })));

        setMinistryRotations((ministryRotationsRes.data ?? []).map(row => ({
          id: row.id,
          courseId: row.course_id,
          studentId: row.student_id,
          studentName: profileName(row.student),
          teamId: row.team_id,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          locked: row.locked,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })));

        setMinistrySessions((ministrySessionsRes.data ?? []).map(row => ({
          id: row.id,
          teamId: row.team_id,
          serviceDate: row.service_date,
          title: row.title,
          serviceType: row.service_type,
          createdBy: row.created_by,
          createdByName: profileName(row.creator),
          generalView: row.general_view ?? null,
          winsTestimonies: row.wins_testimonies ?? null,
          challenges: row.challenges ?? null,
          timelyActions: row.timely_actions ?? null,
          submittedAt: row.submitted_at ?? row.created_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })));

        setMinistryAttendance((ministryAttendanceRes.data ?? []).map(row => ({
          id: row.id,
          sessionId: row.session_id,
          studentId: row.student_id,
          studentName: profileName(row.student),
          status: row.status,
          markedBy: row.marked_by,
          markedAt: row.marked_at,
        })));
      }
    } catch (err) {
      setError('Failed to load attendance data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [users]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ============================================
  // DERIVED: CURRENT DUTY (this week)
  // ============================================
  const currentWeekStart = getCurrentWeekStart();

  // Re-map prayer names when users load after schedule rows.
  useEffect(() => {
    setPrayerSchedule(prev => prev.map(entry => ({
      ...entry,
      tuesdayStudentName: users.find(user => user.id === entry.tuesdayStudentId)?.name ?? entry.tuesdayStudentName,
      thursdayStudentName: users.find(user => user.id === entry.thursdayStudentId)?.name ?? entry.thursdayStudentName,
    })));
  }, [users]);

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

  const generatePrayerScheduleForSchoolYear = async (
    options: PrayerScheduleGenerateOptions
  ): Promise<void> => {
    if (!options.includeFirstYear && !options.includeSecondYear) return;

    const selectedCourses = courses.filter(course => {
      if (!isCourseActive(course)) return false;
      if (course.courseType === 'first_year') return options.includeFirstYear;
      if (course.courseType === 'second_year') return options.includeSecondYear;
      return false;
    });
    const weeks = getSchoolYearWeeks(selectedCourses);
    if (weeks.length === 0) return;

    const selectedCourseIds = new Set(selectedCourses.map(course => course.id));
    const enrolledStudentIds = new Set<string>();
    for (const enrollment of courseStudents) {
      if (selectedCourseIds.has(enrollment.courseId)) {
        enrolledStudentIds.add(enrollment.studentId);
      }
    }

    const students = sortByFirstName(
      users.filter(user => enrolledStudentIds.has(user.id) && user.roles.includes('student'))
    );
    if (students.length === 0) return;

    const studentIds = students.map(student => student.id);
    const thursdayOffset = studentIds.length > 1 ? 1 : 0;
    const rotation = generatePrayerSchedule(studentIds, weeks, 0, thursdayOffset);

    const rows = rotation.map(row => ({
      week_start: row.weekStart,
      week_end: dateToString(getWeekEnd(new Date(row.weekStart))),
      tuesday_student_id: row.tuesdayStudentId,
      thursday_student_id: row.thursdayStudentId,
    }));

    const { error: deleteError } = await supabase.from('prayer_schedule').delete().gte('id', 0);
    if (deleteError) throw deleteError;

    for (let i = 0; i < rows.length; i += 50) {
      const { error: insertError } = await supabase.from('prayer_schedule').insert(rows.slice(i, i + 50));
      if (insertError) throw insertError;
    }

    await fetchAll();
  };

  const generateWellScheduleForCourse = async (courseId: number): Promise<void> => {
    const course = courses.find(item => item.id === courseId);
    if (!course || !isCourseActive(course)) return;

    const weeks = getWeeksBetween(course.startDate, course.endDate);
    const rows = weeks.map(weekStart => ({
      course_id: courseId,
      week_start: weekStart,
      well_date: getWellDateForWeek(weekStart),
    }));

    const { error: deleteError } = await supabase
      .from('well_schedule')
      .delete()
      .eq('course_id', courseId);
    if (deleteError) throw deleteError;

    for (let i = 0; i < rows.length; i += 50) {
      const { error: insertError } = await supabase.from('well_schedule').insert(rows.slice(i, i + 50));
      if (insertError) throw insertError;
    }

    await fetchAll();
  };

  const removeWellScheduleDate = async (wellDate: string, courseIds?: number[]): Promise<void> => {
    let query = supabase
      .from('well_schedule')
      .delete()
      .eq('well_date', wellDate);

    if (courseIds && courseIds.length > 0) {
      query = query.in('course_id', courseIds);
    }

    const { error: deleteError } = await query;
    if (deleteError) throw deleteError;

    await fetchAll();
  };

  const updatePrayerAssignment = async (
    entryId: number,
    updates: { tuesdayStudentId?: string | null; thursdayStudentId?: string | null }
  ): Promise<void> => {
    const payload: Record<string, string | null> = {};
    if (updates.tuesdayStudentId !== undefined) payload.tuesday_student_id = updates.tuesdayStudentId;
    if (updates.thursdayStudentId !== undefined) payload.thursday_student_id = updates.thursdayStudentId;

    const { error: updateError } = await supabase
      .from('prayer_schedule')
      .update(payload)
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
    year: number, month: number, timesAttended: number,
    timesLate: number
  ): Promise<void> => {
    const { error: upsertError } = await supabase
      .from('the_well_attendance')
      .upsert({
        student_id: studentId, course_id: courseId,
        year, month, times_attended: timesAttended,
        times_late: timesLate,
        marked_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_id,year,month' });
    if (upsertError) throw upsertError;
  };

  const markWellSessionAttendance = async (
    weekStart: string,
    courseId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ): Promise<void> => {
    const sessionRows = records.map(r => ({
      student_id: r.studentId,
      course_id: courseId,
      week_start: weekStart,
      status: r.status,
      marked_by: currentUser.id,
      marked_at: new Date().toISOString(),
    }));

    const { error: sessionError } = await supabase
      .from('the_well_session_attendance')
      .upsert(sessionRows, { onConflict: 'student_id,course_id,week_start' });
    if (sessionError) throw sessionError;

    const changedStudentIds = new Set(records.map(r => r.studentId));
    const mergedSessions = [
      ...theWellSessionAttendance.filter(
        s => !(
          s.courseId === courseId &&
          s.weekStart === weekStart &&
          changedStudentIds.has(s.studentId)
        )
      ),
      ...records.map(r => ({
        id: 0,
        studentId: r.studentId,
        courseId,
        weekStart,
        status: r.status,
        markedBy: currentUser.id,
        markedAt: new Date().toISOString(),
      })),
    ];

    const { year, month } = getYearMonthFromWeekStart(weekStart);
    const monthTotals = aggregateWellSessionsForMonth(
      mergedSessions,
      courseId,
      year,
      month
    );

    const studentIds = new Set([
      ...records.map(r => r.studentId),
      ...mergedSessions
        .filter(s => {
          const ym = getYearMonthFromWeekStart(s.weekStart);
          return s.courseId === courseId && ym.year === year && ym.month === month;
        })
        .map(s => s.studentId),
    ]);

    await Promise.all(
      Array.from(studentIds).map(studentId => {
        const totals = monthTotals.get(studentId) ?? { timesAttended: 0, timesLate: 0 };
        return upsertTheWellAttendance(
          studentId,
          courseId,
          year,
          month,
          totals.timesAttended,
          totals.timesLate
        );
      })
    );

    await fetchAll();
  };

  const upsertTheWellAttendanceWithRefetch = async (
    studentId: string, courseId: number,
    year: number, month: number, timesAttended: number,
    timesLate: number
  ): Promise<void> => {
    await upsertTheWellAttendance(
      studentId, courseId, year, month, timesAttended, timesLate
    );
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

  const upsertMinistryTeam = async (
    input: Partial<MinistryTeam> & { name: string }
  ): Promise<void> => {
    const memberIds = input.memberIds ?? input.members?.map(member => member.userId) ?? [];
    const primaryLeaderId = memberIds[0] ?? input.leaderId ?? null;
    const row = {
      name: input.name,
      name_bg: input.nameBg ?? null,
      info: input.info ?? null,
      leader_id: primaryLeaderId,
      call_time: input.callTime ?? null,
      service_type: input.serviceType ?? 'sunday',
      service_day: input.serviceDay ?? (input.serviceType === 'non_sunday' ? null : 0),
      required_credits: input.requiredCredits ?? settings.ministrySundayRequiredCredits,
      requirement_period_months: input.requirementPeriodMonths ?? settings.ministrySundayPeriodMonths,
      requirement_unit: input.requirementUnit ?? 'month',
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data: teamRow, error: teamError } = input.id
      ? await supabase
          .from('ministry_teams')
          .update(row)
          .eq('id', input.id)
          .select('id')
          .single()
      : await supabase
          .from('ministry_teams')
          .insert(row)
          .select('id')
          .single();
    if (teamError) throw teamError;

    const teamId = teamRow?.id ?? input.id;
    if (teamId && input.memberIds) {
      const now = new Date().toISOString();
      const { error: deactivateError } = await supabase
        .from('ministry_team_members')
        .update({ active: false, updated_at: now })
        .eq('team_id', teamId);
      if (deactivateError) throw deactivateError;

      if (memberIds.length > 0) {
        const { error: membersError } = await supabase
          .from('ministry_team_members')
          .upsert(memberIds.map(userId => ({
            team_id: teamId,
            user_id: userId,
            role: 'leader',
            can_submit_reports: true,
            active: true,
            updated_at: now,
          })), { onConflict: 'team_id,user_id' });
        if (membersError) throw membersError;
      }
    }

    await fetchAll();
  };

  const upsertMinistryRotation = async (
    input: Partial<MinistryRotation> & {
      courseId: number;
      studentId: string;
      teamId: number;
      startDate: string;
      endDate: string;
    }
  ): Promise<void> => {
    const { error: upsertError } = await supabase
      .from('ministry_rotations')
      .upsert({
        id: input.id,
        course_id: input.courseId,
        student_id: input.studentId,
        team_id: input.teamId,
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status ?? 'active',
        locked: input.locked ?? false,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      });
    if (upsertError) throw upsertError;
    await fetchAll();
  };

  const createMinistrySession = async (
    input: {
      teamId: number;
      serviceDate: string;
      title: string;
      serviceType?: 'sunday' | 'non_sunday';
      generalView?: string | null;
      winsTestimonies?: string | null;
      challenges?: string | null;
      timelyActions?: string | null;
    }
  ): Promise<void> => {
    const team = ministryTeams.find(t => t.id === input.teamId);
    const { error: insertError } = await supabase
      .from('ministry_service_sessions')
      .insert({
        team_id: input.teamId,
        service_date: input.serviceDate,
        title: input.title,
        service_type: input.serviceType ?? team?.serviceType ?? 'sunday',
        created_by: currentUser.id,
        general_view: input.generalView ?? null,
        wins_testimonies: input.winsTestimonies ?? null,
        challenges: input.challenges ?? null,
        timely_actions: input.timelyActions ?? null,
        submitted_at: new Date().toISOString(),
      });
    if (insertError) throw insertError;
    await fetchAll();
  };

  const submitMinistryServiceReport = async (
    input: {
      teamId: number;
      serviceDate: string;
      generalView: string;
      winsTestimonies?: string | null;
      challenges?: string | null;
      timelyActions: string;
      records: Array<{ studentId: string; status: AttendanceStatus }>;
    }
  ): Promise<void> => {
    const team = ministryTeams.find(t => t.id === input.teamId);
    const submittedAt = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('ministry_service_sessions')
      .insert({
        team_id: input.teamId,
        service_date: input.serviceDate,
        title: `${team?.name ?? 'Ministry team'} service report`,
        service_type: team?.serviceType ?? 'sunday',
        created_by: currentUser.id,
        general_view: input.generalView.trim(),
        wins_testimonies: input.winsTestimonies?.trim() || null,
        challenges: input.challenges?.trim() || null,
        timely_actions: input.timelyActions.trim(),
        submitted_at: submittedAt,
      })
      .select('id')
      .single();

    if (sessionError) throw sessionError;

    const rows = input.records.map(record => ({
      session_id: session.id,
      student_id: record.studentId,
      status: record.status,
      marked_by: currentUser.id,
      marked_at: submittedAt,
    }));

    if (rows.length > 0) {
      const { error: attendanceError } = await supabase
        .from('ministry_service_attendance')
        .insert(rows);
      if (attendanceError) throw attendanceError;
    }

    await fetchAll();
  };

  const markMinistryAttendance = async (
    sessionId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ): Promise<void> => {
    const rows = records.map(r => ({
      session_id: sessionId,
      student_id: r.studentId,
      status: r.status,
      marked_by: currentUser.id,
      marked_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('ministry_service_attendance')
      .upsert(rows, { onConflict: 'session_id,student_id' });
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
        present_credit: newSettings.presentCredit ?? settings.presentCredit,
        late_credit: newSettings.lateCredit ?? settings.lateCredit,
        absent_credit: newSettings.absentCredit ?? settings.absentCredit,
        late_uses_global_credit: newSettings.lateUsesGlobalCredit ?? settings.lateUsesGlobalCredit,
        late_class_weight: newSettings.lateCredit ?? settings.lateCredit,
        late_saturday_weight: newSettings.lateCredit ?? settings.lateCredit,
        late_well_weight: newSettings.lateCredit ?? settings.lateCredit,
        graduation_threshold: newSettings.graduationThreshold ?? settings.graduationThreshold,
        class_required_percent: newSettings.classRequiredPercent ?? settings.classRequiredPercent,
        class_included_weekdays: newSettings.classIncludedWeekdays ?? settings.classIncludedWeekdays,
        class_sessions_per_day: newSettings.classSessionsPerDay ?? settings.classSessionsPerDay,
        class_joint_counts_once: newSettings.classJointCountsOnce ?? settings.classJointCountsOnce,
        the_well_enabled: newSettings.theWellEnabled ?? settings.theWellEnabled,
        the_well_weekday: newSettings.theWellWeekday ?? settings.theWellWeekday,
        the_well_required_per_month: newSettings.theWellRequiredPerMonth ?? settings.theWellRequiredPerMonth,
        the_well_fallback_enabled: newSettings.theWellFallbackEnabled ?? settings.theWellFallbackEnabled,
        the_well_fallback_percent: newSettings.theWellFallbackPercent ?? settings.theWellFallbackPercent,
        activation_enabled: newSettings.activationEnabled ?? settings.activationEnabled,
        activation_frequency: newSettings.activationFrequency ?? settings.activationFrequency,
        activation_max_lost_credits: newSettings.activationMaxLostCredits ?? settings.activationMaxLostCredits,
        activation_detection_rule: newSettings.activationDetectionRule ?? settings.activationDetectionRule,
        ministry_enabled: newSettings.ministryEnabled ?? settings.ministryEnabled,
        ministry_sunday_required_credits: newSettings.ministrySundayRequiredCredits ?? settings.ministrySundayRequiredCredits,
        ministry_sunday_period_months: newSettings.ministrySundayPeriodMonths ?? settings.ministrySundayPeriodMonths,
        ministry_first_year_rotation_months: newSettings.ministryFirstYearRotationMonths ?? settings.ministryFirstYearRotationMonths,
        ministry_second_year_rotation_months: newSettings.ministrySecondYearRotationMonths ?? settings.ministrySecondYearRotationMonths,
        ministry_team_leaders_can_mark: newSettings.ministryTeamLeadersCanMark ?? settings.ministryTeamLeadersCanMark,
        ministry_admins_can_override_rotations: newSettings.ministryAdminsCanOverrideRotations ?? settings.ministryAdminsCanOverrideRotations,
        status_on_track_threshold: newSettings.statusOnTrackThreshold ?? settings.statusOnTrackThreshold,
        status_at_risk_threshold: newSettings.statusAtRiskThreshold ?? settings.statusAtRiskThreshold,
        status_failing_threshold: newSettings.statusFailingThreshold ?? settings.statusFailingThreshold,
        show_classes_on_student_view: newSettings.showClassesOnStudentView ?? settings.showClassesOnStudentView,
        show_the_well_on_student_view: newSettings.showTheWellOnStudentView ?? settings.showTheWellOnStudentView,
        show_activation_on_student_view: newSettings.showActivationOnStudentView ?? settings.showActivationOnStudentView,
        show_ministry_on_student_view: newSettings.showMinistryOnStudentView ?? settings.showMinistryOnStudentView,
        show_fallback_scores: newSettings.showFallbackScores ?? settings.showFallbackScores,
        remind_missing_class_attendance: newSettings.remindMissingClassAttendance ?? settings.remindMissingClassAttendance,
        remind_missing_well_attendance: newSettings.remindMissingWellAttendance ?? settings.remindMissingWellAttendance,
        remind_missing_ministry_attendance: newSettings.remindMissingMinistryAttendance ?? settings.remindMissingMinistryAttendance,
        sunday_required_per_month: newSettings.ministrySundayRequiredCredits ?? settings.ministrySundayRequiredCredits,
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
      s.classes.filter(c => c.date && !isActivationSaturdayClass(c))
    );
    const saturdayClasses = course.subjects.flatMap(s =>
      s.classes.filter(c => isActivationSaturdayClass(c))
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
      const myMinistryRotations = ministryRotations.filter(
        rotation => rotation.studentId === studentId && rotation.courseId === courseId
      );
      const myMinistrySessionIds = new Set(
        ministrySessions
          .filter(session => myMinistryRotations.some(rotation =>
            rotation.teamId === session.teamId &&
            session.serviceDate >= rotation.startDate &&
            session.serviceDate <= rotation.endDate
          ))
          .map(session => session.id)
      );
      const myMinistryAttendance = ministryAttendance.filter(
        record => record.studentId === studentId && myMinistrySessionIds.has(record.sessionId)
      );

      const classScore = calculateClassScore(
        myClassAtt, regularClasses.length, settings
      );
      const satScore = calculateSaturdayScore(
        mySatAtt, saturdayClasses.length, settings
      );
      const wellScore = calculateTheWellScore(myWell, settings);
      const sunScore = calculateSundayScore(mySunday, settings);
      const ministryCredits = calculateAttendanceCredits(myMinistryAttendance, settings);
      const ministryRequiredCredits = myMinistryRotations.reduce((total, rotation) => {
        const team = ministryTeams.find(t => t.id === rotation.teamId);
        if (!team) return total;
        const start = new Date(`${rotation.startDate}T00:00:00`);
        const end = new Date(`${rotation.endDate}T00:00:00`);
        const months = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
        );
        return total + (Math.ceil(months / team.requirementPeriodMonths) * team.requiredCredits);
      }, 0);
      const ministryScore = ministryRequiredCredits === 0 ? 1 : Math.min(1, ministryCredits / ministryRequiredCredits);
      const classCredits = calculateAttendanceCredits(myClassAtt, settings);
      const classRequiredCredits = regularClasses.length * settings.classRequiredPercent;
      const saturdayCredits = calculateAttendanceCredits(mySatAtt, settings);
      const saturdayLostCredits = Math.max(0, saturdayClasses.length - saturdayCredits);
      const wellCredits = myWell.reduce((sum, record) =>
        sum + record.timesAttended + (record.timesLate * settings.lateCredit),
        0
      );
      const wellRequiredCredits = myWell.length * settings.theWellRequiredPerMonth;
      const wellFallbackRequiredCredits = settings.theWellFallbackEnabled
        ? Math.max(0, Math.round(course.subjects.flatMap(s => s.classes).length * 0) || myWell.length * 4 * settings.theWellFallbackPercent)
        : wellRequiredCredits;
      const wellPassing = wellRequiredCredits === 0
        ? true
        : wellCredits >= wellRequiredCredits || (settings.theWellFallbackEnabled && wellCredits >= wellFallbackRequiredCredits);
      const gates: AttendanceGateSummary[] = [
        {
          key: 'classes',
          label: 'Classes',
          earnedCredits: classCredits,
          requiredCredits: classRequiredCredits,
          possibleCredits: regularClasses.length,
          score: classScore,
          status: classCredits >= classRequiredCredits ? 'passing' : classScore >= settings.statusAtRiskThreshold ? 'at_risk' : 'failing',
          detail: `${classCredits.toFixed(1)} of ${classRequiredCredits.toFixed(1)} required credits`,
        },
        {
          key: 'the_well',
          label: 'The Well',
          earnedCredits: wellCredits,
          requiredCredits: wellRequiredCredits,
          possibleCredits: myWell.length * settings.theWellRequiredPerMonth,
          score: wellScore,
          status: wellPassing ? 'passing' : wellScore >= settings.statusAtRiskThreshold ? 'at_risk' : 'failing',
          detail: `${wellCredits.toFixed(1)} monthly credits recorded`,
          fallbackDetail: settings.theWellFallbackEnabled ? `${wellFallbackRequiredCredits.toFixed(1)} yearly fallback credits required` : undefined,
        },
        {
          key: 'activation',
          label: 'Activation Saturday',
          earnedCredits: saturdayCredits,
          requiredCredits: Math.max(0, saturdayClasses.length - settings.activationMaxLostCredits),
          possibleCredits: saturdayClasses.length,
          score: satScore,
          status: saturdayLostCredits <= settings.activationMaxLostCredits ? 'passing' : 'failing',
          detail: `${saturdayLostCredits.toFixed(1)} lost credits; max ${settings.activationMaxLostCredits}`,
        },
        {
          key: 'ministry',
          label: 'Ministry',
          earnedCredits: ministryCredits,
          requiredCredits: ministryRequiredCredits,
          possibleCredits: Math.max(ministryRequiredCredits, myMinistryAttendance.length),
          score: ministryScore,
          status: ministryCredits >= ministryRequiredCredits ? 'passing' : ministryScore >= settings.statusAtRiskThreshold ? 'at_risk' : 'failing',
          detail: ministryRequiredCredits === 0 ? 'No ministry rotation assigned' : `${ministryCredits.toFixed(1)} of ${ministryRequiredCredits.toFixed(1)} service credits`,
        },
      ];
      const overall = calculateOverallScore(
        classScore, satScore, wellScore, ministryScore
      );
      const meetsAllGates = gates.every(gate => gate.status === 'passing');

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
        ministryScore,
        gates,
        overallScore: overall,
        meetsGraduationThreshold: meetsAllGates,
      };
    }).filter((s): s is StudentAttendanceSummary => s !== null);
  }, [courses, courseStudents, users, classAttendance,
    theWellAttendance, sundayAttendance, ministryRotations, ministrySessions,
    ministryAttendance, ministryTeams, settings]);

  return {
    settings, dutySchedule, prayerSchedule, wellSchedule, transferRequests,
    classAttendance, theWellAttendance, theWellSessionAttendance, sundayAttendance,
    ministryTeams, ministryRotations, ministrySessions, ministryAttendance,
    loading, error,
    currentDuty, myCurrentDuty, isOnDuty,
    pendingTransferRequests,
    generateDutyScheduleForCourse, updateDutyAssignment,
    generatePrayerScheduleForSchoolYear, updatePrayerAssignment,
    generateWellScheduleForCourse, removeWellScheduleDate,
    requestDutyTransfer, resolveTransferRequest,
    markClassAttendance, markWellSessionAttendance,
    upsertTheWellAttendance: upsertTheWellAttendanceWithRefetch,
    upsertSundayAttendance, updateSettings,
    upsertMinistryTeam, upsertMinistryRotation, createMinistrySession, markMinistryAttendance,
    submitMinistryServiceReport,
    getCourseSummaries,
    refetch: fetchAll,
  };
}
