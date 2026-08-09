#!/bin/sh
# Arranca un PostgreSQL desechable para los tests del esquema.
#
# No es un entorno de desarrollo: es un servidor de usar y tirar en /tmp, sin TCP, sin
# contraseña y sin persistencia. Sirve para una cosa — comprobar que las políticas RLS
# y los triggers de facturación hacen lo que dicen —, y una política RLS mal escrita se
# lee perfectamente, así que probarla de verdad es la única forma de saberlo.
#
#   ./packages/db/scripts/start-test-db.sh
#   pnpm test packages/db
#
# Si no hay servidor, los tests del esquema se saltan con un aviso en lugar de fallar.
# Para apuntar a otro servidor: PGHOST, PGPORT y PGUSER.
set -eu

PGDATA="${PGDATA:-/tmp/mupg}"
PORT="${PGPORT:-55432}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"

if [ -z "$BIN" ]; then
  echo "No encuentro los binarios de PostgreSQL. Instala postgresql-16 o fija PGHOST." >&2
  exit 1
fi

if [ -S "$PGDATA/.s.PGSQL.$PORT" ]; then
  echo "Ya hay un PostgreSQL escuchando en $PGDATA (puerto $PORT)."
  exit 0
fi

# `initdb` se niega a ejecutarse como root, así que en contenedores hay que delegar en
# el usuario `postgres`. Fuera de ellos se ejecuta con el usuario actual.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  RUN="su postgres -s /bin/sh -c"
  rm -rf "$PGDATA"; mkdir -p "$PGDATA"; chown postgres "$PGDATA"
else
  RUN="sh -c"
  rm -rf "$PGDATA"; mkdir -p "$PGDATA"
fi

# `-A trust` es aceptable porque el servidor solo escucha en un socket de /tmp y no
# guarda nada real. No copies esta línea a ningún otro sitio.
$RUN "PATH=$BIN:\$PATH initdb -U postgres -A trust '$PGDATA' >/dev/null"
$RUN "PATH=$BIN:\$PATH pg_ctl -D '$PGDATA' -l '$PGDATA/log' -o '-p $PORT -k $PGDATA' start"

chmod 777 "$PGDATA" 2>/dev/null || true
echo "PostgreSQL listo en $PGDATA (puerto $PORT)."
