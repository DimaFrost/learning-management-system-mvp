import { defineTranslations } from '../defineTranslations';

export const filePreviewTranslations = defineTranslations({
  en: {
    'filePreview.closePreview': 'Close preview',
    'filePreview.subtitle': '{typeLabel} · Opens in platform preview',
    'filePreview.download': 'Download',
    'filePreview.openInTab': 'Open in tab',
    'filePreview.loading': 'Loading preview…',
    'filePreview.failedTitle': "We couldn't load a preview for this file.",
    'filePreview.failedHint': 'You can still download it or open it in a new browser tab.',
  },
  bg: {
    'filePreview.closePreview': 'Затвори прегледа',
    'filePreview.subtitle': '{typeLabel} · Отваря се в преглед в платформата',
    'filePreview.download': 'Изтегли',
    'filePreview.openInTab': 'Отвори в раздел',
    'filePreview.loading': 'Зареждане на преглед…',
    'filePreview.failedTitle': 'Прегледът на този файл не можа да бъде зареден.',
    'filePreview.failedHint': 'Все още може да се изтегли или отвори в нов браузърен раздел.',
  },
});
