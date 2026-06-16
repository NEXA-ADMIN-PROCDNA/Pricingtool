// utils.ts — cn(): the standard shadcn/Tailwind className combiner. Merges
// conditional classes (clsx) and dedupes conflicting Tailwind utilities
// (tailwind-merge) so the last class wins. Used by virtually every UI component.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
