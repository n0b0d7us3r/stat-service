#!/usr/bin/env bash
# Бэкап пользовательских SQLite-БД в /tmp/{email}/backup-*.tar.gz
#
# Использование:
#   ./db-backup.sh
#   DATA_DIR=/path/to/data ./db-backup.sh
#   BACKUP_ROOT=/tmp ./db-backup.sh
#
# Требуется: sqlite3, tar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/tmp}"

resolve_data_dir() {
  if [[ -n "${DATA_DIR:-}" ]]; then
    echo "$DATA_DIR"
    return
  fi

  if [[ -f /data/auth.sqlite ]]; then
    echo /data
    return
  fi

  if [[ -f "$SCRIPT_DIR/backend/data/auth.sqlite" ]]; then
    echo "$SCRIPT_DIR/backend/data"
    return
  fi

  if [[ -f "$SCRIPT_DIR/data/auth.sqlite" ]]; then
    echo "$SCRIPT_DIR/data"
    return
  fi

  echo "Не найден auth.sqlite. Задайте DATA_DIR, например:" >&2
  echo "  DATA_DIR=/data ./db-backup.sh" >&2
  exit 1
}

sanitize_dir_name() {
  local email="$1"
  local safe
  safe="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]' | tr '@' '_' | tr -cd 'a-z0-9._-')"
  if [[ -z "$safe" ]]; then
    safe="user"
  fi
  printf '%s' "$safe"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Команда «$1» не найдена. Установите её и повторите." >&2
    exit 1
  fi
}

require_command sqlite3
require_command tar

DATA_DIR="$(resolve_data_dir)"
AUTH_DB="$DATA_DIR/auth.sqlite"
USERS_DIR="$DATA_DIR/users"

if [[ ! -f "$AUTH_DB" ]]; then
  echo "Файл auth.sqlite не найден: $AUTH_DB" >&2
  exit 1
fi

if [[ ! -d "$USERS_DIR" ]]; then
  echo "Каталог пользовательских БД не найден: $USERS_DIR" >&2
  exit 1
fi

timestamp="$(date +%Y-%m-%d_%H%M%S)"
backed_up=0
skipped=0

while IFS='|' read -r user_id email; do
  [[ -z "$user_id" ]] && continue

  user_dir="$BACKUP_ROOT/$(sanitize_dir_name "$email")"
  db_path="$USERS_DIR/${user_id}.sqlite"
  archive="$user_dir/backup-${timestamp}.tar.gz"

  if [[ ! -f "$db_path" ]]; then
    echo "Пропуск: нет БД для $email (id=$user_id)" >&2
    skipped=$((skipped + 1))
    continue
  fi

  mkdir -p "$user_dir"

  staging="$(mktemp -d)"
  backup_file="$staging/${user_id}.sqlite"

  sqlite3 "$db_path" ".backup '$backup_file'"

  tar -czf "$archive" -C "$staging" .
  rm -rf "$staging"

  echo "OK: $email -> $archive"
  backed_up=$((backed_up + 1))
done < <(sqlite3 -separator '|' "$AUTH_DB" "SELECT id, email FROM users ORDER BY id")

if [[ "$backed_up" -eq 0 ]]; then
  echo "Бэкапы не созданы (пользователей: 0 или нет файлов БД)." >&2
  exit 1
fi

echo "Готово: $backed_up бэкап(ов), пропущено: $skipped. Каталог: $BACKUP_ROOT"
