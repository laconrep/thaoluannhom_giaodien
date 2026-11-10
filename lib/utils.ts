import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Số nhóm cố định mặc định theo sĩ số: khoảng 6 học sinh/nhóm, tối thiểu 2, tối đa 8. */
export function defaultGroupCount(capacity: number): number {
  return Math.max(2, Math.min(8, Math.round(capacity / 6)))
}
