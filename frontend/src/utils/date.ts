import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

// تنسيق التاريخ بالعربية
export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  return format(new Date(date), formatStr, { locale: ar });
}

// الوقت النسبي (منذ ...)
export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: ar, addSuffix: true });
}

// تنسيق الوقت
export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm:ss', { locale: ar });
}

// تنسيق التاريخ والوقت معاً
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ar });
}
