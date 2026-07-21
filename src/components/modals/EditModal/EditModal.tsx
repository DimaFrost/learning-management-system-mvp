import { useState, useEffect, type FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import type { User, Class, Subject, Course, CourseStudent, EditingItem, MinistryTeam } from '../../../types/lms';
import { EditCourseForm } from './EditCourseForm';
import { EditSubjectForm } from './EditSubjectForm';
import { EditClassForm } from './EditClassForm';
import { EditUserForm } from './EditUserForm';
import { hasActiveCourseOfType } from '../../../utils/courseUtils';

export interface FormData {
  [key: string]: any;
}

interface EditModalProps {
  editingItem: EditingItem | null;
  onClose: () => void;
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  ministryTeams?: MinistryTeam[];
  onAddCourse: (data: Partial<Course>) => void;
  onUpdateCourse: (id: number, data: Partial<Course>) => void;
  onAddSubject: (courseId: number, data: Partial<Subject>) => void;
  onUpdateSubject: (courseId: number, subjectId: number, data: Partial<Subject>) => void;
  onAddClass: (courseId: number, subjectId: number, data: Partial<Class>) => void;
  onUpdateClass: (courseId: number, subjectId: number, classId: number, data: Partial<Class>) => void;
  onAddUser: (data: Partial<User>) => void;
  onUpdateUser: (id: string, data: Partial<User>) => void;
  onAssignUserToCourse: (userId: string, courseId: number, mentorId?: string | null) => void;
  onSetUserActiveYearGroup?: (userId: string, courseId: number) => void | Promise<void>;
  onRemoveUserFromCourse: (userId: string, courseId: number, users: User[], courses: Course[]) => void;
  onUpsertMinistryTeam?: (input: Partial<MinistryTeam> & { name: string }) => Promise<void>;
  checkCourseUniqueness: (courseType: string, graduationYear: number, courses: Course[], excludeCourseId?: number) => boolean;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  getCourseOptions: (courses: Course[]) => { id: number; displayName: string; courseType: string; graduationYear: number }[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
}

export function EditModal({
  editingItem,
  onClose,
  courses,
  users,
  courseStudents,
  ministryTeams = [],
  onAddCourse,
  onUpdateCourse,
  onAddSubject,
  onUpdateSubject,
  onAddClass,
  onUpdateClass,
  onAddUser,
  onUpdateUser,
  onAssignUserToCourse,
  onSetUserActiveYearGroup,
  onRemoveUserFromCourse,
  onUpsertMinistryTeam,
  checkCourseUniqueness,
  checkDoubleBooking,
  getUserById,
}: EditModalProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<{[key: string]: string | null}>({});

  useEffect(() => {
    if (editingItem && editingItem.data) {
      if (editingItem.type === 'class') {
        setFormData({
          ...editingItem.data,
          subjectId: editingItem.subjectId ?? (editingItem.data as FormData)?.subjectId ?? '',
        });
      } else {
        setFormData(editingItem.data);
      }
    } else {
      // Pre-populate form with any provided properties
      const initialData: FormData = {};
      if (editingItem?.date) {
        initialData.date = editingItem.date;
      }
      if (editingItem?.type === 'class') {
        initialData.subjectId = editingItem.subjectId ?? '';
      }
      if (
        editingItem?.type === 'subject' &&
        editingItem.planningCourseOptions &&
        !editingItem.data
      ) {
        const opts = editingItem.planningCourseOptions;
        initialData.courseId = opts.firstYearId ?? opts.secondYearId ?? '';
      }
      setFormData(initialData);
    }
    setErrors({});
  }, [editingItem]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: {[key: string]: string | null} = {};

    // Validation
    if (!formData.courseType && editingItem && editingItem.type === 'course') {
      newErrors.courseType = 'Year Group Type is required';
    }
    if (!formData.graduationYear && editingItem && editingItem.type === 'course') {
      newErrors.graduationYear = 'Year of Graduation is required';
    }
    if (editingItem?.type === 'course') {
      if (!formData.startDate) newErrors.startDate = 'Start date is required';
      if (!formData.endDate) newErrors.endDate = 'End date is required';
    }
    
    // Check for duplicate course type + graduation year combination
    if (editingItem && editingItem.type === 'course' && formData.courseType && formData.graduationYear) {
      const excludeCourseId = editingItem.data ? (editingItem.data as Course).id : undefined;
      const isDuplicate = checkCourseUniqueness(formData.courseType, formData.graduationYear, courses, excludeCourseId);
      const activeTypeExists = hasActiveCourseOfType(formData.courseType, courses, excludeCourseId);
      
      if (isDuplicate) {
        const courseTypeLabel = formData.courseType === 'first_year' ? 'First Year' : 'Second Year';
        newErrors.courseType = `${courseTypeLabel} ${formData.graduationYear} already exists`;
        newErrors.graduationYear = `${courseTypeLabel} ${formData.graduationYear} already exists`;
      } else if (activeTypeExists) {
        const courseTypeLabel = formData.courseType === 'first_year' ? 'First Year' : 'Second Year';
        newErrors.courseType = `Archive the active ${courseTypeLabel} year group before creating another one.`;
      }
    }
    if (!formData.name && editingItem && editingItem.type === 'user') {
      newErrors.name = 'Name is required';
    }
    if (!formData.email && editingItem && editingItem.type === 'user') {
      newErrors.email = 'Email is required';
    }
    if (!formData.title && editingItem && (editingItem.type === 'subject' || editingItem.type === 'class')) {
      newErrors.title = 'Title is required';
    }
    if (
      editingItem?.type === 'subject' &&
      editingItem.planningCourseOptions &&
      !editingItem.data &&
      !formData.courseId
    ) {
      newErrors.courseId = 'Course is required';
    }
    if (!formData.date && editingItem && editingItem.type === 'class') {
      newErrors.date = 'Date is required';
    }
    if (!formData.hour && editingItem && editingItem.type === 'class') {
      newErrors.hour = 'Hour is required';
    }
    if (!formData.subjectId && editingItem && editingItem.type === 'class') {
      newErrors.subjectId = 'Subject is required';
    }
    // Teacher and translator are no longer required - vacant roles are allowed and visually indicated
    if (formData.teacherId && formData.translatorId && formData.teacherId === formData.translatorId && editingItem && editingItem.type === 'class') {
      newErrors.teacherId = 'Teacher and Translator cannot be the same person';
      newErrors.translatorId = 'Teacher and Translator cannot be the same person';
    }

    // Check for double-booking conflicts when creating/editing classes
    if (editingItem && editingItem.type === 'class' && formData.date && formData.hour && (formData.teacherId || formData.translatorId)) {
      const excludeClassId = editingItem.data ? (editingItem.data as Class).id : undefined;
      
      // Check teacher conflicts
      if (formData.teacherId) {
        const teacherConflict = checkDoubleBooking(formData.teacherId, formData.date, formData.hour, courses, excludeClassId);
        if (teacherConflict.hasConflict) {
          const conflictDetails = teacherConflict.conflictingClasses
            .map(cls => `${cls.title} (${cls.courseName}) - ${cls.hour} hour`)
            .join(', ');
          newErrors.teacherId = `Teacher is already assigned to: ${conflictDetails}`;
        }
      }
      
      // Check translator conflicts
      if (formData.translatorId) {
        const translatorConflict = checkDoubleBooking(formData.translatorId, formData.date, formData.hour, courses, excludeClassId);
        if (translatorConflict.hasConflict) {
          const conflictDetails = translatorConflict.conflictingClasses
            .map(cls => `${cls.title} (${cls.courseName}) - ${cls.hour} hour`)
            .join(', ');
          newErrors.translatorId = `Translator is already assigned to: ${conflictDetails}`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle different entity types
    if (editingItem && editingItem.type === 'course') {
      if (editingItem.data) {
        onUpdateCourse((editingItem.data as Course).id, formData);
      } else {
        onAddCourse(formData);
      }
    } else if (editingItem && editingItem.type === 'subject') {
      if (editingItem.data && editingItem.courseId) {
        onUpdateSubject(editingItem.courseId, (editingItem.data as Subject).id, formData);
      } else {
        const courseId = editingItem.planningCourseOptions
          ? formData.courseId
          : editingItem.courseId;
        if (courseId) onAddSubject(courseId, formData);
      }
    } else if (editingItem && editingItem.type === 'class') {
      if (editingItem.data && editingItem.courseId && editingItem.subjectId) {
        onUpdateClass(editingItem.courseId, editingItem.subjectId, (editingItem.data as Class).id, formData);
      } else if (formData.subjectId) {
        // Find the course that contains the selected subject
        const course = courses.find(c => c.subjects.some(s => s.id === formData.subjectId));
        if (course) {
          onAddClass(course.id, formData.subjectId, formData);
        }
      }
    } else if (editingItem && editingItem.type === 'user') {
      const {
        assignedYearGroupId,
        assignedMenteeKeys,
        ledTeamIds,
        assignedCourseId,
        assignedMenteeKey,
        ...userFormData
      } = formData;
      if (editingItem.data) {
        const userId = (editingItem.data as User).id;
        onUpdateUser(userId, userFormData);
        if (assignedYearGroupId && onSetUserActiveYearGroup) {
          await onSetUserActiveYearGroup(userId, Number(assignedYearGroupId));
        }
        if (Array.isArray(assignedMenteeKeys)) {
          await Promise.all(assignedMenteeKeys.map(async (key: string) => {
            const [studentId, courseId] = String(key).split(':');
            if (studentId && courseId) {
              await onAssignUserToCourse(studentId, Number(courseId), userId);
            }
          }));
        }
        if (Array.isArray(ledTeamIds) && onUpsertMinistryTeam) {
          await Promise.all(ministryTeams.map(async team => {
            const currentMemberIds = team.members.filter(member => member.active).map(member => member.userId);
            const shouldLead = ledTeamIds.includes(team.id);
            const currentlyLeads = team.members.some(member =>
              member.userId === userId &&
              member.active &&
              (member.role === 'leader' || member.role === 'assistant')
            );
            if (shouldLead === currentlyLeads) return;
            const nextMemberIds = shouldLead
              ? [...currentMemberIds, userId]
              : currentMemberIds.filter(id => id !== userId);
            await onUpsertMinistryTeam({
              ...team,
              memberIds: nextMemberIds,
              leaderId: nextMemberIds[0] ?? null,
            });
          }));
        }
      } else {
        onAddUser(userFormData);
      }
    }

    onClose();
    setFormData({});
    setErrors({});
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Clear conflicting role selection when changing teacher or translator
      if (field === 'teacherId' && value && prev.translatorId === value) {
        newData.translatorId = null;
      } else if (field === 'translatorId' && value && prev.teacherId === value) {
        newData.teacherId = null;
      }
      
      return newData;
    });
    
    // Clear errors for the changed field and related fields
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    if (field === 'teacherId' && errors.translatorId) {
      setErrors(prev => ({ ...prev, translatorId: null }));
    }
    if (field === 'translatorId' && errors.teacherId) {
      setErrors(prev => ({ ...prev, teacherId: null }));
    }
    
          // Clear double-booking errors when date, hour, teacher, or translator changes
          if (field === 'date' || field === 'hour' || field === 'teacherId' || field === 'translatorId') {
            setErrors(prev => ({
              ...prev,
              teacherId: field === 'teacherId' ? null : prev.teacherId,
              translatorId: field === 'translatorId' ? null : prev.translatorId
            }));
          }
          
          // Clear course uniqueness errors when course type or graduation year changes
          if (field === 'courseType' || field === 'graduationYear') {
            setErrors(prev => ({
              ...prev,
              courseType: field === 'courseType' ? null : prev.courseType,
              graduationYear: field === 'graduationYear' ? null : prev.graduationYear
            }));
          }
  };

  if (!editingItem || editingItem.type === 'log') return null;
  const isUserModal = editingItem.type === 'user';

  const getModalTitle = () => {
    const action = editingItem.data ? 'Edit' : 'Add';
    switch (editingItem.type) {
      case 'course': return `${action} Year Group`;
      case 'subject': return `${action} Subject`;
      case 'class': return `${action} Session`;
      case 'user': return `${action} User`;
      default: return 'Edit Item';
    }
  };

  const getFormFields = () => {
    switch (editingItem.type) {
      case 'course':
        return <EditCourseForm formData={formData} errors={errors} onChange={handleChange} />;
      case 'subject':
        return (
          <EditSubjectForm
            formData={formData}
            errors={errors}
            onChange={handleChange}
            users={users}
            planningCourseOptions={
              !editingItem.data ? editingItem.planningCourseOptions : undefined
            }
          />
        );
      case 'class':
        return (
          <EditClassForm
            formData={formData}
            errors={errors}
            onChange={handleChange}
            users={users}
            courses={courses}
          />
        );
      case 'user':
        return (
          <EditUserForm
            formData={formData}
            errors={errors}
            onChange={handleChange}
            editingItem={editingItem}
            courseStudents={courseStudents}
            users={users}
            courses={courses}
            ministryTeams={ministryTeams}
            getUserById={getUserById}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`w-full max-h-[90vh] overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:rounded-2xl ${isUserModal ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
              {editingItem.data ? 'Editing' : 'Creating'}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">{getModalTitle()}</h3>
          </div>
          <button 
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex max-h-[calc(90vh-82px)] flex-col">
          <div className="tbo-scrollbar flex-1 overflow-y-auto p-5">
            {getFormFields()}
          </div>

          <div className="flex justify-end gap-3 border-t border-[#e5e5e5] bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626]"
            >
              <Save className="w-4 h-4" />
              <span>{editingItem.data ? 'Update' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
