import { useState, useEffect, type FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import type { User, Class, Subject, Course, CourseStudent, EditingItem, FormData } from '../../../types/lms';
import { EditCourseForm } from './EditCourseForm';
import { EditSubjectForm } from './EditSubjectForm';
import { EditClassForm } from './EditClassForm';
import { EditUserForm } from './EditUserForm';

interface EditModalProps {
  editingItem: EditingItem | null;
  onClose: () => void;
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  onAddCourse: (data: Partial<Course>) => void;
  onUpdateCourse: (id: number, data: Partial<Course>) => void;
  onAddSubject: (courseId: number, data: Partial<Subject>) => void;
  onUpdateSubject: (courseId: number, subjectId: number, data: Partial<Subject>) => void;
  onAddClass: (courseId: number, subjectId: number, data: Partial<Class>) => void;
  onUpdateClass: (courseId: number, subjectId: number, classId: number, data: Partial<Class>) => void;
  onAddUser: (data: Partial<User>) => void;
  onUpdateUser: (id: number, data: Partial<User>) => void;
  onAssignUserToCourse: (userId: number, courseId: number) => void;
  onRemoveUserFromCourse: (userId: number, courseId: number) => void;
  checkCourseUniqueness: (courseType: string, graduationYear: number, courses: Course[], excludeCourseId?: number) => boolean;
  checkDoubleBooking: (personId: number, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  getCourseOptions: (courses: Course[]) => { id: number; displayName: string; courseType: string; graduationYear: number }[];
  getUserById: (id: number) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
}

export function EditModal({
  editingItem,
  onClose,
  courses,
  users,
  courseStudents,
  onAddCourse,
  onUpdateCourse,
  onAddSubject,
  onUpdateSubject,
  onAddClass,
  onUpdateClass,
  onAddUser,
  onUpdateUser,
  onAssignUserToCourse,
  onRemoveUserFromCourse,
  checkCourseUniqueness,
  checkDoubleBooking,
  getUserById,
}: EditModalProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<{[key: string]: string | null}>({});

  useEffect(() => {
    if (editingItem && editingItem.data) {
      setFormData(editingItem.data);
    } else {
      // Pre-populate form with any provided properties
      const initialData: FormData = {};
      if (editingItem?.date) {
        initialData.date = editingItem.date;
      }
      setFormData(initialData);
    }
    setErrors({});
  }, [editingItem]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: {[key: string]: string | null} = {};

    // Validation
    if (!formData.courseType && editingItem && editingItem.type === 'course') {
      newErrors.courseType = 'Course Type is required';
    }
    if (!formData.graduationYear && editingItem && editingItem.type === 'course') {
      newErrors.graduationYear = 'Year of Graduation is required';
    }
    
    // Check for duplicate course type + graduation year combination
    if (editingItem && editingItem.type === 'course' && formData.courseType && formData.graduationYear) {
      const excludeCourseId = editingItem.data ? (editingItem.data as Course).id : undefined;
      const isDuplicate = checkCourseUniqueness(formData.courseType, formData.graduationYear, courses, excludeCourseId);
      
      if (isDuplicate) {
        const courseTypeLabel = formData.courseType === 'first_year' ? 'First Year' : 'Second Year';
        newErrors.courseType = `${courseTypeLabel} ${formData.graduationYear} already exists`;
        newErrors.graduationYear = `${courseTypeLabel} ${formData.graduationYear} already exists`;
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
      } else if (editingItem.courseId) {
        onAddSubject(editingItem.courseId, formData);
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
      if (editingItem.data) {
        onUpdateUser((editingItem.data as User).id, formData);
      } else {
        onAddUser(formData);
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
        newData.translatorId = '';
      } else if (field === 'translatorId' && value && prev.teacherId === value) {
        newData.teacherId = '';
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

  const getModalTitle = () => {
    const action = editingItem.data ? 'Edit' : 'Add';
    switch (editingItem.type) {
      case 'course': return `${action} Course`;
      case 'subject': return `${action} Subject`;
      case 'class': return `${action} Class`;
      case 'user': return `${action} User`;
      default: return 'Edit Item';
    }
  };

  const getFormFields = () => {
    switch (editingItem.type) {
      case 'course':
        return <EditCourseForm formData={formData} errors={errors} onChange={handleChange} />;
      case 'subject':
        return <EditSubjectForm formData={formData} errors={errors} onChange={handleChange} users={users} />;
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
            courses={courses}
            getUserById={getUserById}
            assignUserToCourse={onAssignUserToCourse}
            removeUserFromCourse={onRemoveUserFromCourse}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {getFormFields()}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
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
