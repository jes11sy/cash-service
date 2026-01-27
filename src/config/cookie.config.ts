/**
 * 🍪 COOKIE CONFIGURATION
 * Общая конфигурация для httpOnly cookies для защиты от XSS атак
 */

export const CookieConfig = {
  // Имена cookies (без __Host- префикса для cross-domain работы)
  ACCESS_TOKEN_NAME: 'access_token',
  REFRESH_TOKEN_NAME: 'refresh_token',
  
  // Опции cookie
  COOKIE_OPTIONS: {
    httpOnly: true,                           // ✅ Защита от XSS - недоступен из JavaScript
    secure: process.env.NODE_ENV === 'production', // ✅ HTTPS только в production
    sameSite: 'none' as const,                // ⚠️ SameSite=None для cross-domain (НЕ защищает от CSRF! Защита на уровне CORS + токенов)
    path: '/',                                // Доступен на всех путях
    domain: '.lead-schem.ru',                 // Cross-domain для api.lead-schem.ru и core.lead-schem.ru
  },
  
  // Время жизни cookies
  ACCESS_TOKEN_MAX_AGE: 15 * 60 * 1000,       // 15 минут
  REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 дней
  
  // Header для переключения в cookie mode
  USE_COOKIES_HEADER: 'x-use-cookies',
  
  // Подпись cookies
  // ⚠️ ОТКЛЮЧЕНО: JWT уже подписан, дополнительная подпись cookie избыточна
  ENABLE_COOKIE_SIGNING: false,
  // 🔒 SECURITY: Рекомендуется использовать отдельный COOKIE_SECRET
  // Fallback на JWT_SECRET только для обратной совместимости
  COOKIE_SECRET: (() => {
    const cookieSecret = process.env.COOKIE_SECRET;
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!cookieSecret && jwtSecret) {
      console.warn('⚠️ SECURITY WARNING: COOKIE_SECRET not set, falling back to JWT_SECRET. Please set a separate COOKIE_SECRET in production.');
    }
    
    return cookieSecret || jwtSecret;
  })(),
} as const;

/**
 * Проверяет, следует ли использовать cookies вместо JSON токенов
 */
export function shouldUseCookies(headers: any): boolean {
  return headers?.[CookieConfig.USE_COOKIES_HEADER] === 'true';
}

/**
 * Получает уникальное имя cookie на основе origin для изоляции между фронтендами
 */
export function getCookieName(baseName: string, origin?: string): string {
  if (!origin) {
    return baseName;
  }
  
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    if (hostname === 'lead-schem.ru') {
      return `${baseName}_masters`;
    }
    
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const subdomain = parts[0];
      return `${baseName}_${subdomain}`;
    }
  } catch (err) {
    // Если ошибка парсинга, используем базовое имя
  }
  
  return baseName;
}

