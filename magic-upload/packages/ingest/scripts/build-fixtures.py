#!/usr/bin/env python3
"""
Genera los ZIP maliciosos con los que se prueba el pipeline de ingesta.

Los fixtures se generan en lugar de guardarse en el repositorio por dos motivos:

  · Un `.zip` binario en el repo es opaco. Aquí se ve exactamente qué contiene cada
    ataque, que es lo que se quiere leer al revisar el código de seguridad.
  · Algunos antivirus y algunos escáneres de repositorios ponen en cuarentena los
    archivos con rutas de traversal o con ratios de compresión absurdos, y eso rompe
    los clones ajenos de formas muy difíciles de diagnosticar.

Los ZIP generados quedan fuera de git (ver .gitignore) y se construyen antes de los
tests con `pnpm fixtures`.

Se usa `zipfile` de Python porque permite escribir nombres de entrada arbitrarios y
atributos externos POSIX, cosa que la herramienta `zip` no deja hacer.
"""

import os
import pathlib
import zipfile

OUT = pathlib.Path(__file__).resolve().parent.parent / "fixtures"

INDEX = b"<!doctype html>\n<html lang=es><title>Hola</title><h1>Hola</h1>\n"
CSS = b"body{font-family:system-ui;margin:2rem}\n"


def build(name):
    """Decorador: registra un constructor de fixture y escribe el archivo."""
    def wrap(fn):
        path = OUT / name
        if path.exists():
            path.unlink()
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            fn(z)
        print(f"  {name:<26} {path.stat().st_size:>9,} bytes")
        return fn
    return wrap


def symlink(z, name, target):
    """Escribe una entrada que es un enlace simbólico POSIX."""
    info = zipfile.ZipInfo(name)
    # 0xA1FF << 16 = S_IFLNK (0xA000) | 0777. Es como marca un enlace un zip de Unix.
    info.external_attr = (0o120777 << 16)
    info.create_system = 3  # Unix
    z.writestr(info, target)


OUT.mkdir(exist_ok=True)
print("Generando fixtures de ingesta en", OUT)


# ── El caso feliz ────────────────────────────────────────────────────────────────
@build("web-valida.zip")
def _(z):
    """Una web normal de varias páginas. Debe publicarse sin tocar nada."""
    z.writestr("index.html", INDEX)
    z.writestr("estilos.css", CSS)
    z.writestr("sobre-mi.html", INDEX)
    z.writestr("img/logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>")


# ── Zip slip ─────────────────────────────────────────────────────────────────────
@build("zip-slip.zip")
def _(z):
    """Traversal clásico con `../`. Debe rechazarse el ZIP entero."""
    z.writestr("index.html", INDEX)
    z.writestr("../../../etc/passwd", b"root:x:0:0::/root:/bin/sh\n")


@build("zip-slip-windows.zip")
def _(z):
    """Traversal con separador de Windows. Un `\\` cuenta como separador."""
    z.writestr("index.html", INDEX)
    z.writestr("..\\..\\windows\\system32\\evil.dll", b"MZ\x90\x00")


@build("zip-slip-absoluto.zip")
def _(z):
    """Ruta absoluta POSIX, sin ningún `..`."""
    z.writestr("index.html", INDEX)
    z.writestr("/etc/cron.d/backdoor", b"* * * * * root curl evil\n")


@build("zip-slip-unidad.zip")
def _(z):
    """Ruta absoluta de Windows con letra de unidad."""
    z.writestr("index.html", INDEX)
    z.writestr("C:/Windows/Temp/evil.txt", b"x")


# ── Enlaces simbólicos ───────────────────────────────────────────────────────────
@build("symlink-escape.zip")
def _(z):
    """
    Enlace simbólico con nombre inofensivo apuntando fuera del árbol.

    El nombre de la entrada es limpio a propósito: así el test comprueba la defensa
    por atributos POSIX y no la de rutas, que ya se prueba aparte.
    """
    z.writestr("index.html", INDEX)
    symlink(z, "secretos.txt", "/etc/passwd")


# ── Zip bomb ─────────────────────────────────────────────────────────────────────
@build("zip-bomb-ratio.zip")
def _(z):
    """
    Un archivo de ceros de 200 MB que comprime a unos pocos KB.

    El tamaño declarado es honesto; lo que dispara la defensa es el ratio.
    """
    z.writestr("index.html", INDEX)
    z.writestr("relleno.bin", b"\x00" * (200 * 1024 * 1024))


@build("zip-bomb-entradas.zip")
def _(z):
    """Una entrada por encima del máximo permitido (10.000 + index.html = 10.001)."""
    z.writestr("index.html", INDEX)
    for i in range(10_000):
        z.writestr(f"f/{i}.txt", b"x")


@build("zip-bomb-anidada.zip")
def _(z):
    """
    Un ZIP dentro de un ZIP. No debe descomprimirse recursivamente: se guarda inerte.

    Es el vector clásico de la bomba recursiva tipo 42.zip.
    """
    inner = OUT / "_inner.zip"
    with zipfile.ZipFile(inner, "w", zipfile.ZIP_DEFLATED) as iz:
        iz.writestr("relleno.bin", b"\x00" * (50 * 1024 * 1024))
    z.writestr("index.html", INDEX)
    z.write(inner, "adjunto.zip")
    inner.unlink()


# ── Ejecutables ──────────────────────────────────────────────────────────────────
@build("ejecutable-extension.zip")
def _(z):
    """Ejecutable con su extensión real. Lo caza la lista de extensiones."""
    z.writestr("index.html", INDEX)
    z.writestr("instalador.exe", b"MZ\x90\x00\x03\x00\x00\x00")


@build("extension-falsa.zip")
def _(z):
    """
    Ejecutable ELF renombrado a `.png`.

    La extensión es inocente, así que la primera barrera no lo ve. Lo caza el número
    mágico, que es la barrera que no se puede esquivar.
    """
    z.writestr("index.html", INDEX)
    z.writestr("img/logo.png", b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 64)


@build("codigo-de-servidor.zip")
def _(z):
    """PHP. Se rechaza con un mensaje propio que explica que no ejecutamos código."""
    z.writestr("index.html", INDEX)
    z.writestr("contacto.php", b"<?php mail($_POST['to'], 'x', 'y'); ?>")


# ── Estructura ───────────────────────────────────────────────────────────────────
@build("carpeta-anidada.zip")
def _(z):
    """
    El error nº 1 del usuario no técnico: comprimir la carpeta, no su contenido.

    Debe publicarse subiendo un nivel automáticamente, sin avisar.
    """
    z.writestr("mi-web/index.html", INDEX)
    z.writestr("mi-web/estilos.css", CSS)
    z.writestr("mi-web/img/logo.svg", b"<svg/>")


@build("carpeta-doble-anidada.zip")
def _(z):
    """Dos niveles de carpeta. Pasa dos veces por la subida de nivel."""
    z.writestr("descargas/mi-web/index.html", INDEX)
    z.writestr("descargas/mi-web/estilos.css", CSS)


@build("sin-index.zip")
def _(z):
    """No hay página de inicio en ninguna parte. El error debe nombrar los HTML."""
    z.writestr("pagina.html", INDEX)
    z.writestr("otra.html", INDEX)
    z.writestr("estilos.css", CSS)


@build("basura-del-sistema.zip")
def _(z):
    """
    Metadatos de macOS y compañía. Se ignoran en silencio: no son error del usuario.

    El `.env` está en la misma lista, y ahí sí importa: publicarlo filtraría secretos.
    """
    z.writestr("index.html", INDEX)
    z.writestr("__MACOSX/._index.html", b"\x00\x05\x16\x07")
    z.writestr(".DS_Store", b"\x00\x00\x00\x01Bud1")
    z.writestr(".env", b"STRIPE_SECRET_KEY=sk_live_no_deberia_publicarse\n")
    z.writestr("node_modules/left-pad/index.js", b"module.exports=1")


def build_nombre_hostil():
    """
    Nombre de entrada con un byte NUL. No tiene ningún uso legítimo, y sí varios
    ilegítimos: el NUL trunca cadenas en cualquier capa escrita en C, así que
    `logo\\x00.png` puede validarse como PNG y escribirse como `logo`.

    Hay que escribirlo a mano. `zipfile.writestr()` TRUNCA el nombre en el NUL y
    genera una entrada llamada `logo`, es decir, un ZIP perfectamente inofensivo.

    Esto costó un test que pasaba en verde sin probar nada: el pipeline «rechazaba»
    un ataque que la fixture nunca había llegado a contener. Si alguna vez añades un
    fixture con caracteres raros, verifica los bytes, no la intención.

    El truco: se genera con un nombre de la MISMA longitud (`logoX.png`, 9 bytes) y
    luego se sustituye la `X` por el NUL. Al no cambiar la longitud, los offsets del
    directorio central siguen siendo válidos y el ZIP es estructuralmente correcto.
    """
    path = OUT / "nombre-hostil.zip"
    if path.exists():
        path.unlink()

    placeholder = b"logoX.png"
    hostile = b"logo\x00.png"
    assert len(placeholder) == len(hostile), "el parcheo exige longitudes iguales"

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", INDEX)
        z.writestr(placeholder.decode(), b"\x89PNG\r\n\x1a\n")

    raw = path.read_bytes()
    # El nombre aparece dos veces: cabecera local y directorio central.
    assert raw.count(placeholder) == 2, "se esperaban dos apariciones del nombre"
    path.write_bytes(raw.replace(placeholder, hostile))

    print(f"  {'nombre-hostil.zip':<26} {path.stat().st_size:>9,} bytes")


build_nombre_hostil()

print("Listo.")
