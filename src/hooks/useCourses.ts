import { useState } from 'react';
import type { Course, Subject, Class } from '../types/lms';
import { initialCourses } from '../data/seed';
import { getNextClassDate, checkDoubleBooking } from '../utils/scheduling';
import { getCourseDisplayName } from '../utils/courseUtils';

type ShowConfirmation = (title: string, message: string, confirmText: string, onConfirm: () => void) => void;

export function useCourses(showConfirmation: ShowConfirmation) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(new Set());
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());

  const addCourse = (courseData: Partial<Course>) => {
    const newCourse: Course = {
      id: Math.max(...courses.map(c => c.id)) + 1,
      courseType: courseData.courseType || 'first_year',
      graduationYear: courseData.graduationYear || new Date().getFullYear() + 1,
      startDate: courseData.startDate || '',
      endDate: courseData.endDate || '',
      status: courseData.status || 'active',
      subjects: []
    };
    setCourses([...courses, newCourse]);
  };

  const updateCourse = (id: number, updates: Partial<Course>) => {
    setCourses(courses.map(course => 
      course.id === id ? { ...course, ...updates } : course
    ));
  };

  const deleteCourse = (id: number) => {
    const course = courses.find(c => c.id === id);
    if (!course) return;
    
    const courseTypeLabel = course.courseType === 'first_year' ? 'First Year' : 'Second Year';
    const courseName = `${courseTypeLabel} ${course.graduationYear}`;
    
    showConfirmation(
      'Delete Course',
      `Are you sure you want to delete "${courseName}"? This will also delete all subjects and classes within this course. This action cannot be undone.`,
      'Delete Course',
      () => {
        setCourses(courses.filter(course => course.id !== id));
      }
    );
  };

  const addSubject = (courseId: number, subjectData: Partial<Subject>) => {
    const duration = subjectData.duration || 1;
    const primaryTeacherId = subjectData.primaryTeacherId || 0;
    const startDate = subjectData.startDate || '';
    
    // Pre-create classes based on duration
    const preCreatedClasses: Class[] = [];
    for (let i = 1; i <= duration; i++) {
      preCreatedClasses.push({
        id: Math.max(...courses.flatMap(c => c.subjects.flatMap(s => s.classes.map(cls => cls.id))), 0) + i,
        title: `${subjectData.title || ''} - Class ${i}`,
        date: getNextClassDate(startDate, i - 1), // i-1 because we want 0-based indexing
        hour: i % 2 === 1 ? 'first' : 'second', // Alternate between first and second hour
        teacherId: primaryTeacherId,
        translatorId: 0 // Vacant by default
      });
    }

    const newSubject: Subject = {
      id: Math.max(...courses.flatMap(c => c.subjects.map(s => s.id)), 0) + 1,
      title: subjectData.title || '',
      description: subjectData.description || '',
      startDate: startDate,
      duration: duration,
      primaryTeacherId: primaryTeacherId,
      classes: preCreatedClasses
    };
    setCourses(courses.map(course => 
      course.id === courseId 
        ? { ...course, subjects: [...course.subjects, newSubject] }
        : course
    ));
  };

  const updateSubject = (courseId: number, subjectId: number, updates: Partial<Subject>) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId ? { ...subject, ...updates } : subject
            )
          }
        : course
    ));
  };

  const deleteSubject = (courseId: number, subjectId: number) => {
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    if (!course || !subject) return;
    
    const courseTypeLabel = course.courseType === 'first_year' ? 'First Year' : 'Second Year';
    const courseName = `${courseTypeLabel} ${course.graduationYear}`;
    
    showConfirmation(
      'Delete Subject',
      `Are you sure you want to delete "${subject.title}" from "${courseName}"? This will also delete all classes within this subject. This action cannot be undone.`,
      'Delete Subject',
      () => {
        setCourses(courses.map(course => 
          course.id === courseId 
            ? { ...course, subjects: course.subjects.filter(s => s.id !== subjectId) }
            : course
        ));
      }
    );
  };

  const addClass = (courseId: number, subjectId: number, classData: Partial<Class>) => {
    const newClass: Class = {
      id: Math.max(...courses.flatMap(c => c.subjects.flatMap(s => s.classes.map(cls => cls.id))), 0) + 1,
      title: classData.title || '',
      date: classData.date || '',
      hour: classData.hour || 'first',
      teacherId: classData.teacherId || 0,
      translatorId: classData.translatorId || 0
    };
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId 
                ? { ...subject, classes: [...subject.classes, newClass] }
                : subject
            )
          }
        : course
    ));
  };

  const updateClass = (courseId: number, subjectId: number, classId: number, updates: Partial<Class>) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId 
                ? {
                    ...subject, 
                    classes: subject.classes.map(cls => 
                      cls.id === classId ? { ...cls, ...updates } : cls
                    )
                  }
                : subject
            )
          }
        : course
    ));
  };

  const deleteClass = (courseId: number, subjectId: number, classId: number) => {
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    const classToDelete = subject?.classes.find(cls => cls.id === classId);
    if (!course || !subject || !classToDelete) return;
    
    showConfirmation(
      'Delete Class',
      `Are you sure you want to delete "${classToDelete.title}" from "${subject.title}"? This action cannot be undone.`,
      'Delete Class',
      () => {
        setCourses(courses.map(course => 
          course.id === courseId 
            ? {
                ...course, 
                subjects: course.subjects.map(subject => 
                  subject.id === subjectId 
                    ? { ...subject, classes: subject.classes.filter(cls => cls.id !== classId) }
                    : subject
                )
              }
            : course
        ));
      }
    );
  };

  const toggleCourseCollapse = (courseId: number) => {
    const newCollapsed = new Set(collapsedCourses);
    if (newCollapsed.has(courseId)) {
      newCollapsed.delete(courseId);
    } else {
      newCollapsed.add(courseId);
    }
    setCollapsedCourses(newCollapsed);
  };

  const toggleSubjectCollapse = (courseId: number, subjectId: number) => {
    const key = `${courseId}-${subjectId}`;
    const newCollapsed = new Set(collapsedSubjects);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSubjects(newCollapsed);
  };

  return {
    courses, setCourses,
    collapsedCourses, collapsedSubjects,
    addCourse, updateCourse, deleteCourse,
    addSubject, updateSubject, deleteSubject,
    addClass, updateClass, deleteClass,
    toggleCourseCollapse, toggleSubjectCollapse,
  };
}
