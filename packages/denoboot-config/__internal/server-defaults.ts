// deno-lint-ignore-file no-explicit-any

export const gettextNoop = <T extends string>(s: T): T => s;

/* ====================
 * CORE
 * ==================== */

export const DEBUG = false;
export const DEBUG_PROPAGATE_EXCEPTIONS = false;

export const ADMINS: string[] = [];
export const MANAGERS = ADMINS;

export const INTERNAL_IPS: string[] = [];
export const ALLOWED_HOSTS: string[] = [];

export const TIME_ZONE = "America/Chicago";
export const USE_TZ = true;

export const LANGUAGE_CODE = "en-us";

export const LANGUAGES: ReadonlyArray<[string, string]> = [
  ["af", gettextNoop("Afrikaans")],
  ["ar", gettextNoop("Arabic")],
  ["ar-dz", gettextNoop("Algerian Arabic")],
  ["ast", gettextNoop("Asturian")],
  ["az", gettextNoop("Azerbaijani")],
  ["bg", gettextNoop("Bulgarian")],
  ["be", gettextNoop("Belarusian")],
  ["bn", gettextNoop("Bengali")],
  ["br", gettextNoop("Breton")],
  ["bs", gettextNoop("Bosnian")],
  ["ca", gettextNoop("Catalan")],
  ["ckb", gettextNoop("Central Kurdish (Sorani)")],
  ["cs", gettextNoop("Czech")],
  ["cy", gettextNoop("Welsh")],
  ["da", gettextNoop("Danish")],
  ["de", gettextNoop("German")],
  ["dsb", gettextNoop("Lower Sorbian")],
  ["el", gettextNoop("Greek")],
  ["en", gettextNoop("English")],
  ["en-au", gettextNoop("Australian English")],
  ["en-gb", gettextNoop("British English")],
  ["eo", gettextNoop("Esperanto")],
  ["es", gettextNoop("Spanish")],
  ["es-ar", gettextNoop("Argentinian Spanish")],
  ["es-co", gettextNoop("Colombian Spanish")],
  ["es-mx", gettextNoop("Mexican Spanish")],
  ["es-ni", gettextNoop("Nicaraguan Spanish")],
  ["es-ve", gettextNoop("Venezuelan Spanish")],
  ["et", gettextNoop("Estonian")],
  ["eu", gettextNoop("Basque")],
  ["fa", gettextNoop("Persian")],
  ["fi", gettextNoop("Finnish")],
  ["fr", gettextNoop("French")],
  ["fy", gettextNoop("Frisian")],
  ["ga", gettextNoop("Irish")],
  ["gd", gettextNoop("Scottish Gaelic")],
  ["gl", gettextNoop("Galician")],
  ["he", gettextNoop("Hebrew")],
  ["hi", gettextNoop("Hindi")],
  ["hr", gettextNoop("Croatian")],
  ["hsb", gettextNoop("Upper Sorbian")],
  ["ht", gettextNoop("Haitian Creole")],
  ["hu", gettextNoop("Hungarian")],
  ["hy", gettextNoop("Armenian")],
  ["ia", gettextNoop("Interlingua")],
  ["id", gettextNoop("Indonesian")],
  ["ig", gettextNoop("Igbo")],
  ["io", gettextNoop("Ido")],
  ["is", gettextNoop("Icelandic")],
  ["it", gettextNoop("Italian")],
  ["ja", gettextNoop("Japanese")],
  ["ka", gettextNoop("Georgian")],
  ["kab", gettextNoop("Kabyle")],
  ["kk", gettextNoop("Kazakh")],
  ["km", gettextNoop("Khmer")],
  ["kn", gettextNoop("Kannada")],
  ["ko", gettextNoop("Korean")],
  ["ky", gettextNoop("Kyrgyz")],
  ["lb", gettextNoop("Luxembourgish")],
  ["lt", gettextNoop("Lithuanian")],
  ["lv", gettextNoop("Latvian")],
  ["mk", gettextNoop("Macedonian")],
  ["ml", gettextNoop("Malayalam")],
  ["mn", gettextNoop("Mongolian")],
  ["mr", gettextNoop("Marathi")],
  ["ms", gettextNoop("Malay")],
  ["my", gettextNoop("Burmese")],
  ["nb", gettextNoop("Norwegian Bokmål")],
  ["ne", gettextNoop("Nepali")],
  ["nl", gettextNoop("Dutch")],
  ["nn", gettextNoop("Norwegian Nynorsk")],
  ["os", gettextNoop("Ossetic")],
  ["pa", gettextNoop("Punjabi")],
  ["pl", gettextNoop("Polish")],
  ["pt", gettextNoop("Portuguese")],
  ["pt-br", gettextNoop("Brazilian Portuguese")],
  ["ro", gettextNoop("Romanian")],
  ["ru", gettextNoop("Russian")],
  ["sk", gettextNoop("Slovak")],
  ["sl", gettextNoop("Slovenian")],
  ["sq", gettextNoop("Albanian")],
  ["sr", gettextNoop("Serbian")],
  ["sr-latn", gettextNoop("Serbian Latin")],
  ["sv", gettextNoop("Swedish")],
  ["sw", gettextNoop("Swahili")],
  ["ta", gettextNoop("Tamil")],
  ["te", gettextNoop("Telugu")],
  ["tg", gettextNoop("Tajik")],
  ["th", gettextNoop("Thai")],
  ["tk", gettextNoop("Turkmen")],
  ["tr", gettextNoop("Turkish")],
  ["tt", gettextNoop("Tatar")],
  ["udm", gettextNoop("Udmurt")],
  ["ug", gettextNoop("Uyghur")],
  ["uk", gettextNoop("Ukrainian")],
  ["ur", gettextNoop("Urdu")],
  ["uz", gettextNoop("Uzbek")],
  ["vi", gettextNoop("Vietnamese")],
  ["zh-hans", gettextNoop("Simplified Chinese")],
  ["zh-hant", gettextNoop("Traditional Chinese")],
];

export const LANGUAGES_BIDI = ["he", "ar", "ar-dz", "ckb", "fa", "ug", "ur"];

export const USE_I18N = true;
export const LOCALE_PATHS: string[] = [];

/* ====================
 * COOKIES / HTTP
 * ==================== */

export const DEFAULT_CHARSET = "utf-8";
export const APPEND_SLASH = true;
export const PREPEND_WWW = false;
export const FORCE_SCRIPT_NAME: string | null = null;

export const X_FRAME_OPTIONS = "DENY";
export const USE_X_FORWARDED_HOST = false;
export const USE_X_FORWARDED_PORT = false;

/* ====================
 * SECURITY
 * ==================== */

export const SECRET_KEY = "";
export const SECRET_KEY_FALLBACKS: string[] = [];

export const SECURE_CONTENT_TYPE_NOSNIFF = true;
export const SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin";
export const SECURE_HSTS_INCLUDE_SUBDOMAINS = false;
export const SECURE_HSTS_PRELOAD = false;
export const SECURE_HSTS_SECONDS = 0;
export const SECURE_REDIRECT_EXEMPT: string[] = [];
export const SECURE_REFERRER_POLICY = "same-origin";
export const SECURE_SSL_HOST: string | null = null;
export const SECURE_SSL_REDIRECT = false;

export const SECURE_CSP: Record<string, any> = {};
export const SECURE_CSP_REPORT_ONLY: Record<string, any> = {};

/* ====================
 * DATABASE / CACHE
 * ==================== */

export const DATABASES: Record<string, any> = {};
export const DATABASE_ROUTERS: string[] = [];

export const CACHES: Record<string, any> = {
  default: {
    BACKEND: "denoboot.cache.memory",
  },
};

export const CACHE_MIDDLEWARE_KEY_PREFIX = "";
export const CACHE_MIDDLEWARE_SECONDS = 600;
export const CACHE_MIDDLEWARE_ALIAS = "default";

/* ====================
 * APPLICATION
 * ==================== */

export const INSTALLED_APPS: string[] = [];
export const MIDDLEWARE: string[] = [];

export const TEMPLATES: any[] = [];

// export const DEFAULT_AUTO_FIELD = "denoboot.db.BigInt";

/* ====================
 * STATIC / MEDIA
 * ==================== */

export const MEDIA_ROOT = "";
export const MEDIA_URL = "";

export const STATIC_ROOT: string | null = null;
export const STATIC_URL: string | null = null;

export const STATICFILES_DIRS: string[] = [];
export const STATICFILES_FINDERS: string[] = [];

/* ====================
 * LOGGING
 * ==================== */

export const LOGGING_CONFIG = "denoboot.logging.configure";
export const LOGGING: Record<string, any> = {};

/* ====================
 * SESSIONS
 * ==================== */

export const SESSION_COOKIE_NAME = "sessionid";
export const SESSION_COOKIE_AGE = 60 * 60 * 24 * 14;
export const SESSION_COOKIE_DOMAIN: string | null = null;
export const SESSION_COOKIE_SECURE = false;
export const SESSION_COOKIE_PATH = "/";
export const SESSION_COOKIE_HTTPONLY = true;
export const SESSION_COOKIE_SAMESITE: "Lax" | "Strict" | "None" = "Lax";

export const SESSION_SAVE_EVERY_REQUEST = false;
export const SESSION_EXPIRE_AT_BROWSER_CLOSE = false;

export const SESSION_ENGINE = "denoboot.sessions.memory";
export const SESSION_SERIALIZER = "json";

/* ====================
 * AUTH / CSRF / TASKS
 * ==================== */

export const AUTH_USER_MODEL = "auth.User";
export const AUTHENTICATION_BACKENDS = ["denoboot.auth.model"];

export const CSRF_COOKIE_NAME = "csrftoken";
export const CSRF_COOKIE_AGE = 60 * 60 * 24 * 365;
export const CSRF_COOKIE_DOMAIN: string | null = null;
export const CSRF_COOKIE_PATH = "/";
export const CSRF_COOKIE_SECURE = false;
export const CSRF_COOKIE_HTTPONLY = false;
export const CSRF_COOKIE_SAMESITE: "Lax" | "Strict" | "None" = "Lax";
export const CSRF_TRUSTED_ORIGINS: string[] = [];
export const CSRF_USE_SESSIONS = false;

export const TASKS = {
  default: {
    BACKEND: "denoboot.tasks.immediate",
  },
};
