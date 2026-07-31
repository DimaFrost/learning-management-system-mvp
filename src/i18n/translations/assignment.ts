import { defineTranslations } from '../defineTranslations';

export const assignmentTranslations = defineTranslations({
  en: {
    'assignment.create.editTitle': 'Edit Assignment',
    'assignment.create.titlePlaceholder': 'Assignment title',
    'assignment.create.descriptionLabel': 'Description / instructions',
    'assignment.create.descriptionPlaceholder': 'Instructions for students...',
    'assignment.create.dueDate': 'Due Date',
    'assignment.create.error.titleRequired': 'Title is required',
    'assignment.create.error.pointsRange': 'Points must be between 0 and 1000',
    'assignment.create.saveChanges': 'Save Changes',
  },
  bg: {
    'assignment.create.editTitle': 'Редактирай задание',
    'assignment.create.titlePlaceholder': 'Заглавие на задание',
    'assignment.create.descriptionLabel': 'Описание / инструкции',
    'assignment.create.descriptionPlaceholder': 'Инструкции за студентите...',
    'assignment.create.dueDate': 'Краен срок',
    'assignment.create.error.titleRequired': 'Заглавието е задължително',
    'assignment.create.error.pointsRange': 'Точките трябва да са между 0 и 1000',
    'assignment.create.saveChanges': 'Запази промените',
  },
});
