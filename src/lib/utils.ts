import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export const NIGERIAN_CLASSES = [
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SS 1', 'SS 2', 'SS 3'
]

export const SS_STREAMS = ['Science', 'Arts', 'Commercial']

export const TERM_NAMES = ['First Term', 'Second Term', 'Third Term']

export function gradeFromScore(score: number, total: number): { grade: string; remark: string } {
  const pct = (score / total) * 100
  if (pct >= 75) return { grade: 'A', remark: 'Excellent' }
  if (pct >= 65) return { grade: 'B', remark: 'Very Good' }
  if (pct >= 50) return { grade: 'C', remark: 'Good' }
  if (pct >= 40) return { grade: 'D', remark: 'Pass' }
  if (pct >= 30) return { grade: 'E', remark: 'Fair' }
  return { grade: 'F', remark: 'Fail' }
}
