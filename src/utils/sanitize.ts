import { Transform } from 'class-transformer';

/**
 * 🔒 SECURITY: Утилита для санитизации текстовых полей
 * Удаляет потенциально опасные HTML/JS теги для защиты от XSS
 */

// Регулярные выражения для опасных паттернов
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // <script> tags
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // <iframe> tags
  /javascript:/gi, // javascript: protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onload, etc.)
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, // <object> tags
  /<embed\b[^>]*>/gi, // <embed> tags
  /<link\b[^>]*>/gi, // <link> tags
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, // <style> tags
  /expression\s*\(/gi, // CSS expression()
  /url\s*\(\s*['"]?\s*data:/gi, // data: URLs in CSS
];

/**
 * Базовая санитизация строки от XSS
 */
export function sanitizeString(input: string | null | undefined): string | null | undefined {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Удаляем опасные паттерны
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Экранируем оставшиеся HTML сущности
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized.trim();
}

/**
 * Мягкая санитизация - только удаляет опасные паттерны, не экранирует HTML
 * Используется для полей, где допустимы некоторые символы (например, заметки)
 */
export function sanitizeStringSoft(input: string | null | undefined): string | null | undefined {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Удаляем только опасные паттерны
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.trim();
}

/**
 * 🔒 Декоратор для автоматической санитизации строковых полей в DTO
 * Использование: @SanitizeString() перед полем
 */
export function SanitizeString(soft = false) {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    return soft ? sanitizeStringSoft(value) : sanitizeString(value);
  });
}

/**
 * 🔒 Декоратор для мягкой санитизации (для полей типа note, comment)
 */
export function SanitizeStringSoft() {
  return SanitizeString(true);
}
