import type { Course } from '../types/lms';
import { getCourseDisplayName } from './courseUtils';

export function getNextClassDate(startDate: string, classIndex: number): string {
  if (!startDate) return '';
  
  const start = new Date(startDate);
  const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Find the first valid class day (Tuesday or Thursday) from start date
  let daysToAdd = 0;
  if (dayOfWeek === 2) {
    // If start is Tuesday, use it as the first class day
    daysToAdd = 0;
  } else if (dayOfWeek === 4) {
    // If start is Thursday, use it as the first class day
    daysToAdd = 0;
  } else if (dayOfWeek <= 1) {
    // If start is Sunday or Monday, go to next Tuesday
    daysToAdd = 2 - dayOfWeek;
  } else if (dayOfWeek === 3) {
    // If start is Wednesday, go to next Thursday
    daysToAdd = 1;
  } else {
    // If start is Friday or Saturday, go to next Tuesday
    daysToAdd = 9 - dayOfWeek;
  }
  
  // Calculate which week and day to use based on class index
  // Each day has 2 classes: first hour and second hour
  // Classes are grouped by day: 0,1 = first day; 2,3 = second day; 4,5 = first day (next week); etc.
  
  const dayIndex = Math.floor(classIndex / 2); // Which day (0 = first day week 0, 1 = second day week 0, 2 = first day week 1, etc.)
  const weekIndex = Math.floor(dayIndex / 2); // Which week (0, 1, 2, ...)
  const dayInWeek = dayIndex % 2; // Which day in the week (0 = first day, 1 = second day)
  
  // Determine what "first day" and "second day" mean based on the start date
  const isStartTuesday = dayOfWeek === 2;
  const isStartThursday = dayOfWeek === 4;
  
  // Add weeks
  daysToAdd += weekIndex * 7;
  
  // Add days based on the pattern
  if (isStartTuesday) {
    // Start with Tuesday, so: 0 = Tuesday, 1 = Thursday
    if (dayInWeek === 1) {
      daysToAdd += 2; // Thursday is 2 days after Tuesday
    }
  } else if (isStartThursday) {
    // Start with Thursday, so: 0 = Thursday, 1 = Tuesday (next week)
    if (dayInWeek === 1) {
      daysToAdd += 5; // Tuesday is 5 days after Thursday (next week)
    }
  } else {
    // Start with Tuesday (default), so: 0 = Tuesday, 1 = Thursday
    if (dayInWeek === 1) {
      daysToAdd += 2; // Thursday is 2 days after Tuesday
    }
  }
  
  const classDate = new Date(start);
  classDate.setDate(start.getDate() + daysToAdd);
  
  return classDate.toISOString().split('T')[0];
}

export const checkDoubleBooking = (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number): { hasConflict: boolean; conflictingClasses: any[] } => {
  if (personId == null) {
    return { hasConflict: false, conflictingClasses: [] };
  }

  const conflictingClasses: any[] = [];
  
  // Check all classes across all courses for the same date AND hour
  courses.forEach(course => {
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        // Skip the class being edited
        if (excludeClassId && cls.id === excludeClassId) return;
        
        // Check if this class is on the same date and involves the same person
        if (cls.date === date && (cls.teacherId === personId || cls.translatorId === personId)) {
          // Check hour conflicts
          const hasHourConflict = 
            hour === 'both' || cls.hour === 'both' || hour === cls.hour;
          
          if (hasHourConflict) {
            conflictingClasses.push({
              ...cls,
              courseName: getCourseDisplayName(course),
              subjectTitle: subject.title,
              role: cls.teacherId === personId ? 'Teacher' : 'Translator'
            });
          }
        }
      });
    });
  });
  
  return {
    hasConflict: conflictingClasses.length > 0,
    conflictingClasses
  };
};
