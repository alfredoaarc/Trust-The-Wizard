/**
 * Errores del pipeline de ingesta.
 *
 * Los mensajes de error de la subida SON PRODUCTO, no plomería. Es el momento en que
 * un usuario no técnico está más cerca de rendirse, y la diferencia entre que se quede
 * o se vaya es si el mensaje le dice qué archivo falla, por qué, y qué hacer.
 *
 * Reglas de redacción, y se revisan una a una en la revisión de código:
 *
 *   · En español, tuteando, sin jerga. Ni «zip slip» ni «ratio de compresión».
 *   · Di QUÉ archivo. Un zip tiene 300 entradas; «un archivo no es válido» es inútil.
 *   · Di QUÉ HACER. Un error sin salida es un usuario perdido.
 *   · No culpes al usuario. Casi siempre el zip lo generó otra herramienta.
 *
 * Contraejemplo de lo que no hacemos: «Upload failed: file too large».
 */

import { formatBytes } from "@magic-upload/i18n";

export type IngestErrorCode =
  | "ARCHIVO_VACIO"
  | "TIPO_NO_SOPORTADO"
  | "ZIP_CORRUPTO"
  | "RUTA_INSEGURA"
  | "ENLACE_SIMBOLICO"
  | "DEMASIADOS_ARCHIVOS"
  | "DESCOMPRIMIDO_DEMASIADO_GRANDE"
  | "COMPRESION_SOSPECHOSA"
  | "ARCHIVO_EJECUTABLE"
  | "CODIGO_DE_SERVIDOR"
  | "SIN_PAGINA_DE_INICIO"
  | "RUTA_DEMASIADO_LARGA"
  | "ANIDAMIENTO_EXCESIVO";

export class IngestError extends Error {
  readonly code: IngestErrorCode;
  /** Entrada del zip que provocó el fallo, si se puede señalar una. */
  readonly entry: string | undefined;
  /** Qué puede hacer el usuario. Se muestra debajo del mensaje, en tono más suave. */
  readonly hint: string | undefined;

  constructor(code: IngestErrorCode, message: string, opts: { entry?: string; hint?: string } = {}) {
    super(message);
    this.name = "IngestError";
    this.code = code;
    this.entry = opts.entry;
    this.hint = opts.hint;
  }
}

/** Constructores con el texto ya escrito, para que nadie improvise un mensaje. */
export const ingestErrors = {
  archivoVacio: () =>
    new IngestError("ARCHIVO_VACIO", "El archivo que has subido está vacío.", {
      hint: "Comprueba que se ha comprimido correctamente y vuelve a intentarlo.",
    }),

  tipoNoSoportado: (extension: string) =>
    new IngestError(
      "TIPO_NO_SOPORTADO",
      `No podemos publicar archivos ${extension || "sin extensión"}.`,
      {
        hint: "Puedes subir una página HTML, un ZIP con tu web, un PDF o una imagen.",
      },
    ),

  zipCorrupto: () =>
    new IngestError("ZIP_CORRUPTO", "No hemos podido abrir el ZIP: parece dañado.", {
      hint: "Vuelve a comprimir la carpeta y súbelo otra vez. Si lo has descargado de otro sitio, prueba a descargarlo de nuevo.",
    }),

  /**
   * Zip slip. El mensaje NO dice «zip slip» ni «path traversal»: dice que la ruta se
   * sale de la carpeta, que es la verdad y se entiende.
   */
  rutaInsegura: (entry: string) =>
    new IngestError(
      "RUTA_INSEGURA",
      `El archivo «${entry}» apunta fuera de la carpeta del ZIP, así que no lo hemos publicado.`,
      {
        entry,
        hint: "Suele pasar cuando el ZIP se ha creado con una herramienta poco común. Comprime la carpeta desde tu ordenador (clic derecho → Comprimir) y vuelve a subirla.",
      },
    ),

  enlaceSimbolico: (entry: string) =>
    new IngestError(
      "ENLACE_SIMBOLICO",
      `«${entry}» es un acceso directo a otro archivo, y no publicamos accesos directos.`,
      {
        entry,
        hint: "Sustitúyelo por el archivo real antes de comprimir la carpeta.",
      },
    ),

  demasiadosArchivos: (count: number, max: number) =>
    new IngestError(
      "DEMASIADOS_ARCHIVOS",
      `El ZIP contiene ${count.toLocaleString("es-ES")} archivos y el máximo son ${max.toLocaleString("es-ES")}.`,
      {
        hint: "Revisa si se ha colado una carpeta que no hace falta, como «node_modules» o una copia de seguridad.",
      },
    ),

  descomprimidoDemasiadoGrande: (bytes: number, max: number) =>
    new IngestError(
      "DESCOMPRIMIDO_DEMASIADO_GRANDE",
      `Al descomprimir, el ZIP ocupa ${formatBytes(bytes)} y el máximo son ${formatBytes(max)}.`,
      {
        hint: "Comprueba si contiene vídeos o imágenes sin optimizar que puedas dejar fuera.",
      },
    ),

  /**
   * Zip bomb. No decimos «hemos detectado un ataque»: la mayoría de las veces es un
   * ZIP raro, no un atacante, y acusar a un cliente legítimo es peor que el falso
   * negativo. Decimos que no cuadra y damos una salida.
   */
  compresionSospechosa: (entry: string) =>
    new IngestError(
      "COMPRESION_SOSPECHOSA",
      `«${entry}» ocupa muchísimo más al descomprimirse de lo que es razonable, así que hemos parado.`,
      {
        entry,
        hint: "Si es un archivo legítimo y muy grande, escríbenos y lo revisamos a mano.",
      },
    ),

  archivoEjecutable: (entry: string) =>
    new IngestError(
      "ARCHIVO_EJECUTABLE",
      `«${entry}» es un programa ejecutable, y Magic Upload solo publica páginas web.`,
      {
        entry,
        hint: "Quítalo del ZIP y vuelve a subirlo. El resto de tu web se publicará sin problema.",
      },
    ),

  /**
   * PHP y compañía. Es una decisión de posicionamiento: decimos que no claramente y
   * explicamos por qué, en lugar de guardarlo inerte y crear la expectativa de que
   * algún día se ejecutará. Ver «Fuera de alcance» en CLAUDE.md.
   */
  codigoDeServidor: (entry: string, extension: string) =>
    new IngestError(
      "CODIGO_DE_SERVIDOR",
      `«${entry}» es código de servidor (${extension}), y Magic Upload no ejecuta código: publicamos páginas estáticas y nada más.`,
      {
        entry,
        hint: "Es lo que nos permite que tu web sea instantánea y no se caiga nunca. Si tu proyecto necesita PHP, necesitas un hosting tradicional.",
      },
    ),

  /**
   * El error nº 1 de los usuarios no técnicos. Antes de lanzarlo, el pipeline ya ha
   * intentado subir un nivel automáticamente; si llegamos aquí es que de verdad no
   * hay página de inicio en ninguna parte.
   */
  sinPaginaDeInicio: (found: readonly string[]) =>
    new IngestError(
      "SIN_PAGINA_DE_INICIO",
      "No hemos encontrado ningún «index.html» en el ZIP, y es el archivo que abre tu web.",
      {
        hint:
          found.length > 0
            ? `Hemos visto estos archivos HTML: ${found.slice(0, 3).join(", ")}. Renombra el principal a «index.html» y vuelve a subirlo.`
            : "Comprueba que has comprimido la carpeta que contiene tu web, y no una carpeta que la contiene.",
      },
    ),

  rutaDemasiadoLarga: (entry: string) =>
    new IngestError("RUTA_DEMASIADO_LARGA", `La ruta de «${entry}» es demasiado larga.`, {
      entry,
      hint: "Acorta los nombres de las carpetas y vuelve a comprimir.",
    }),

  anidamientoExcesivo: (entry: string) =>
    new IngestError(
      "ANIDAMIENTO_EXCESIVO",
      `«${entry}» está dentro de demasiadas carpetas anidadas.`,
      {
        entry,
        hint: "Simplifica la estructura de carpetas y vuelve a comprimir.",
      },
    ),
} as const;
