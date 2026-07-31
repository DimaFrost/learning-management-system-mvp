import { defineTranslations } from '../defineTranslations';

export const gradeModalTranslations = defineTranslations({
  en: {
    'gradeModal.openSubmission': 'Open submission',
    'gradeModal.lastGraded': 'Last graded: {date}',
    'gradeModal.gradeComment': 'Grade comment',
    'gradeModal.feedbackPlaceholder': 'Optional feedback for the student...',
    'gradeModal.error.pointsRange': 'Points must be between 0 and {maxPoints}',
    'gradeModal.saveGrade': 'Save Grade',
    'gradeModal.returnForRevision': 'Return for Revision',
  },
  bg: {
    'gradeModal.openSubmission': 'Отвори предаване',
    'gradeModal.lastGraded': 'Последно оценено: {date}',
    'gradeModal.gradeComment': 'Коментар към оценката',
    'gradeModal.feedbackPlaceholder': 'Незадължителна обратна връзка за студента...',
    'gradeModal.error.pointsRange': 'Точките трябва да са между 0 и {maxPoints}',
    'gradeModal.saveGrade': 'Запази оценка',
    'gradeModal.returnForRevision': 'Върни за корекция',
  },
});
