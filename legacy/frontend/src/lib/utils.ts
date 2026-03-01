import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCnyPriceOrNotForSale(price?: number | null): string {
  if (!price || price <= 0) return "不出售";
  return `¥${price.toFixed(2)}`;
}
