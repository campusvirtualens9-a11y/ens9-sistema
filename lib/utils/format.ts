import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: es })
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: es })
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return score % 1 === 0 ? score.toString() : score.toFixed(2)
}

export function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatDNI(dni: string): string {
  const clean = dni.replace(/\D/g, '')
  if (clean.length <= 7) return clean
  if (clean.length === 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`
}
