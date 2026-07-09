function parseDate(value: string): Date {
  return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
}

export function formatPlatformDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatPlatformDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatPlatformDate(dateString)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'No due date';
  return formatPlatformDateTime(dateString);
}
