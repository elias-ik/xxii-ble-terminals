export type RssiCategory = 'excellent' | 'good' | 'fair' | 'poor' | 'very-poor' | 'unknown';

export function categorizeRssi(rssi: number | undefined | null): RssiCategory {
  if (typeof rssi !== 'number' || Number.isNaN(rssi)) return 'unknown';
  if (rssi >= -50) return 'excellent';
  if (rssi >= -60) return 'good';
  if (rssi >= -70) return 'fair';
  if (rssi >= -80) return 'poor';
  return 'very-poor';
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
