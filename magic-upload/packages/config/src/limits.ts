/**
 * Límites DUROS de seguridad del pipeline de ingesta.
 *
 * Ojo con la distinción, porque es la que se confunde:
 *
 *   · Estos límites son de SEGURIDAD. Protegen la infraestructura de una zip bomb.
 *     No dependen del plan, no se relajan pagando y no viven en base de datos.
 *
 *   · Los límites de PLAN (tamaño por archivo, sitios activos, dominios propios)
 *     viven en la tabla `plan_limits` para poder ajustarlos sin desplegar, y los
 *     resuelve `@magic-upload/quotas`.
 *
 * Un archivo puede caber en el plan Agencia y aun así ser rechazado aquí. Es correcto.
 */

/** Tamaño máximo del contenedor subido, sea del plan que sea. 2 GB = tope Agencia. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/** Tamaño máximo total tras descomprimir. Frena la zip bomb por volumen absoluto. */
export const MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024 * 1024;

/** Tamaño máximo de una sola entrada descomprimida. */
export const MAX_ENTRY_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024;

/**
 * Ratio de compresión máximo, global y por entrada.
 *
 * Referencia: 42.zip comprime a ratios de millones a uno. Texto o SVG legítimos
 * rara vez pasan de 20:1; 100:1 deja margen amplio y sigue siendo un muro.
 */
export const MAX_COMPRESSION_RATIO = 100;

/** Número máximo de entradas en el zip. Frena la zip bomb por número de archivos. */
export const MAX_ENTRIES = 10_000;

/** Profundidad máxima de directorios anidados. */
export const MAX_PATH_DEPTH = 32;

/** Longitud máxima de la ruta de una entrada. */
export const MAX_PATH_LENGTH = 1024;

/**
 * Extensiones bloqueadas siempre.
 *
 * La comprobación por extensión es la PRIMERA barrera, no la única: un ejecutable
 * renombrado a `.png` se detecta por número mágico en `sniffExecutable()`. Esta lista
 * existe para dar un mensaje de error claro en el caso común y honesto.
 */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  // Ejecutables de escritorio y móviles
  ".exe", ".msi", ".com", ".scr", ".dll", ".apk", ".dmg", ".pkg", ".app", ".deb", ".rpm",
  // Scripts que un usuario podría creer que ejecutamos. No ejecutamos nada.
  ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs", ".jar", ".class",
  // Código de servidor. No hay backend: ver "Fuera de alcance" en CLAUDE.md.
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phar",
  ".asp", ".aspx", ".jsp", ".cgi", ".pl",
];

/**
 * Extensiones de contenedor que NO desempaquetamos recursivamente.
 *
 * Un zip dentro de un zip se almacena tal cual, como archivo inerte. Descomprimir
 * recursivamente es precisamente el vector de la zip bomb anidada.
 */
export const ARCHIVE_EXTENSIONS: readonly string[] = [
  ".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar",
];

/** Nombres de archivo que nunca se publican aunque vengan dentro de un zip. */
export const IGNORED_ENTRIES: readonly string[] = [
  "__MACOSX", ".DS_Store", "Thumbs.db", ".git", ".env", ".env.local",
  ".svn", ".hg", "node_modules", ".npmrc", "desktop.ini",
];

/** Documentos que el pipeline busca como página de entrada, por orden de preferencia. */
export const ENTRY_FILE_CANDIDATES: readonly string[] = [
  "index.html", "index.htm", "default.html", "home.html",
];
