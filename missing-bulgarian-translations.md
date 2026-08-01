# Missing Bulgarian translations

English UI strings that are **not** wired through `t()` in `src/i18n/LanguageContext.tsx`, so they stay English when the app language is Bulgarian.

Fill in the **BG** lines below (or use `missing-bulgarian-translations.csv` in Excel / Google Sheets).

Generated: 2026-08-01
Total unique strings: **73**

Already translated in i18n (omitted here): sidebar workspace chrome, stream list basics, live-session banner, mentorship check-in modal.

---

## Modals (5)

1. Adjust Photo
   - BG:
   - Sources: `src/components/modals/AvatarCropModal.tsx`

2. Cancel
   - BG:
   - Sources: `src/components/modals/AvatarCropModal.tsx`, `src/views/admin/AttendanceView.tsx`

3. Crop preview
   - BG:
   - Sources: `src/components/modals/AvatarCropModal.tsx`

4. Drag to reposition · Use slider to zoom
   - BG:
   - Sources: `src/components/modals/AvatarCropModal.tsx`

5. void | Promise
   - BG:
   - Sources: `src/components/modals/EditModal/EditModal.tsx`, `src/components/modals/MentorAssignModal.tsx`

## Shared views (3)

6. Promise
   - BG:
   - Sources: `src/AuthenticatedApp.tsx`, `src/components/assignments/AssignmentComposer.tsx`, `src/components/modals/CreateAnnouncementModal.tsx`, `src/components/modals/CreateAssignmentModal.tsx`, `src/components/modals/EditModal/EditModal.tsx`, `src/components/modals/GradeModal.tsx`, `src/components/modals/SubmissionDetailModal.tsx`, `src/views/AppRouter.tsx`, `src/views/admin/AttendanceView.tsx`, `src/views/admin/BooksView.tsx`, `src/views/admin/CurriculumPlanningView.tsx`, `src/views/admin/CurriculumView.tsx`, `src/views/admin/MentorshipAssignmentsPanel.tsx`, `src/views/admin/MentorshipHubView.tsx`, `src/views/admin/TuitionView.tsx`, `src/views/admin/planning/SchoolYearSelector.tsx`, `src/views/shared/AnnouncementsView.tsx`, `src/views/shared/ClassDetailView.tsx`, `src/views/shared/ClassworkView.tsx`, `src/views/shared/MessagesView.tsx`, `src/views/shared/TodosView.tsx`, `src/views/shared/classwork/HomeworkAssignmentDetailPage.tsx`, `src/views/shared/classwork/SubjectDetailPage.tsx`, `src/views/shared/tabs/HomeworkTab.tsx`, `src/views/shared/tabs/MaterialsTab.tsx`, `src/views/shared/tabs/StaffNotesTab.tsx`, `src/views/student/DutyMarkingView.tsx`, `src/views/student/MyAttendanceBreakdownView.tsx`, `src/views/student/MyBooksView.tsx`, `src/views/teamLeader/MinistryReportView.tsx`

7. SUBJECTS_PER_PAGE && (
   - BG:
   - Sources: `src/views/shared/ClassworkView.tsx`

8. upload-materials-title
   - BG:
   - Sources: `src/views/shared/classwork/SubjectDetailPage.tsx`

## Admin views (9)

9. assigned
   - BG:
   - Sources: `src/views/admin/BooksView.tsx`

10. assignment.maxPoints) && (
   - BG:
   - Sources: `src/views/admin/BooksView.tsx`

11. EUR
   - BG:
   - Sources: `src/views/admin/TuitionView.tsx`

12. metric-insight-title
   - BG:
   - Sources: `src/views/admin/AdminDashboard.tsx`

13. onlineStudentIds.has(studentId) ? (
   - BG:
   - Sources: `src/views/admin/AttendanceView.tsx`

14. open-signals-title
   - BG:
   - Sources: `src/views/admin/AdminDashboard.tsx`

15. selectedStudentIds.slice(0, 8).length + selectedGroups.length ?
   - BG:
   - Sources: `src/views/admin/TuitionView.tsx`

16. string): Array
   - BG:
   - Sources: `src/views/admin/users/UsersHubView.tsx`

17. user-detail-title
   - BG:
   - Sources: `src/views/admin/users/UsersHubView.tsx`

## Student views (3)

18. assignment.dueDate && assignment.dueDate
   - BG:
   - Sources: `src/views/student/StudentDashboard.tsx`

19. ASSIGNMENTS_PER_PAGE && (
   - BG:
   - Sources: `src/views/student/MyAssignmentsView.tsx`

20. item.dueDate && item.dueDate
   - BG:
   - Sources: `src/views/student/StudentDashboard.tsx`

## Hooks (errors / search labels) (21)

21. Activation Saturday
   - BG:
   - Sources: `src/hooks/useAttendance.ts`

22. Active first year enrollments
   - BG:
   - Sources: `src/hooks/useTodos.ts`

23. Active second year enrollments
   - BG:
   - Sources: `src/hooks/useTodos.ts`

24. Admins, teachers, translators, and mentors
   - BG:
   - Sources: `src/hooks/useTodos.ts`

25. All Staff
   - BG:
   - Sources: `src/hooks/useTodos.ts`

26. Classes
   - BG:
   - Sources: `src/hooks/useAttendance.ts`

27. Digital Check-ins
   - BG:
   - Sources: `src/data/seed.ts`, `src/hooks/useCadenceSettings.ts`

28. First installment
   - BG:
   - Sources: `src/hooks/useTuition.ts`

29. First Year Students
   - BG:
   - Sources: `src/hooks/useTodos.ts`

30. In-Person Check-ins
   - BG:
   - Sources: `src/data/seed.ts`, `src/hooks/useCadenceSettings.ts`

31. Mentors
   - BG:
   - Sources: `src/hooks/useTodos.ts`

32. Ministry
   - BG:
   - Sources: `src/hooks/useAttendance.ts`

33. Second installment
   - BG:
   - Sources: `src/hooks/useTuition.ts`

34. Second Year Students
   - BG:
   - Sources: `src/hooks/useTodos.ts`

35. Teachers
   - BG:
   - Sources: `src/hooks/useTodos.ts`

36. The Well
   - BG:
   - Sources: `src/hooks/useAttendance.ts`

37. Translators
   - BG:
   - Sources: `src/hooks/useTodos.ts`

38. Tuition reminder
   - BG:
   - Sources: `src/hooks/useTuition.ts`

39. Users with the mentor role
   - BG:
   - Sources: `src/hooks/useTodos.ts`

40. Users with the teacher role
   - BG:
   - Sources: `src/hooks/useTodos.ts`

41. Users with the translator role
   - BG:
   - Sources: `src/hooks/useTodos.ts`

## Dev tools (8)

42. Apply
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

43. DEV
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

44. Dev Preview
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

45. Reset
   - BG:
   - Sources: `src/AuthenticatedApp.tsx`, `src/components/dev/DevRolePanel.tsx`

46. Reset to real roles
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

47. Role preview
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

48. Search name or email
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

49. View as user
   - BG:
   - Sources: `src/components/dev/DevRolePanel.tsx`

## Other (24)

50. Advanced CSS - Session 5
   - BG:
   - Sources: `src/data/seed.ts`

51. Advanced React - Session 1
   - BG:
   - Sources: `src/data/seed.ts`

52. Advanced topics in web development
   - BG:
   - Sources: `src/data/seed.ts`

53. Advanced Web Development
   - BG:
   - Sources: `src/data/seed.ts`

54. CSS Introduction - Session 2
   - BG:
   - Sources: `src/data/seed.ts`

55. Data Types - Session 2
   - BG:
   - Sources: `src/data/seed.ts`

56. Database Design - Session 7
   - BG:
   - Sources: `src/data/seed.ts`

57. Database Optimization - Session 3
   - BG:
   - Sources: `src/data/seed.ts`

58. Final Project - Session 8
   - BG:
   - Sources: `src/data/seed.ts`

59. Functions - Session 3
   - BG:
   - Sources: `src/data/seed.ts`

60. HTML & CSS Fundamentals
   - BG:
   - Sources: `src/data/seed.ts`

61. HTML Basics - Session 1
   - BG:
   - Sources: `src/data/seed.ts`

62. JavaScript Fundamentals - Session 3
   - BG:
   - Sources: `src/data/seed.ts`

63. Learn Python programming basics
   - BG:
   - Sources: `src/data/seed.ts`

64. Learn the basics of web markup and styling
   - BG:
   - Sources: `src/data/seed.ts`

65. Modules - Session 4
   - BG:
   - Sources: `src/data/seed.ts`

66. No content available
   - BG:
   - Sources: `src/views/AppRouter.tsx`

67. Node.js Advanced - Session 2
   - BG:
   - Sources: `src/data/seed.ts`

68. Node.js Backend - Session 6
   - BG:
   - Sources: `src/data/seed.ts`

69. Python Fundamentals
   - BG:
   - Sources: `src/data/seed.ts`

70. Python Introduction - Session 1
   - BG:
   - Sources: `src/data/seed.ts`

71. React Basics - Session 4
   - BG:
   - Sources: `src/data/seed.ts`

72. Viewing as
   - BG:
   - Sources: `src/AuthenticatedApp.tsx`

73. You are not on duty this week.
   - BG:
   - Sources: `src/views/AppRouter.tsx`

---

## i18n keys where Bulgarian equals English

_None_

---

## Notes

- Dynamic template strings (backticks with variables) are mostly not listed — check those when translating a screen.
- Knowledge Base admin documentation strings are included.
- Dev tools (`DevRolePanel`) are included; skip if you do not need them translated.
- User-authored content (announcement text, course titles, etc.) is data and is not listed.
- Regenerate: `node scripts/extract-untranslated-strings.mjs`
