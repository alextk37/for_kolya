#!/usr/bin/env bash
# ============================================================
#   mac-postbuild.sh — пост-сборка для macOS (Apple Silicon)
#
#   Решает 3 критические проблемы запуска на macOS M1/M2/M3:
#
#   1. Gatekeeper блокирует неподписанное приложение
#      → Ad-hoc подпись кода (codesign --sign -)
#
#   2. Quarantine-атрибут (com.apple.quarantine) на .app
#      → Удаление xattr -d com.apple.quarantine
#
#   3. "Приложение повреждено" при открытии из Downloads
#      → Удаление quarantine + ad-hoc подпись
#
#   Использование:
#     ./scripts/mac-postbuild.sh              # авто-поиск .app в release/
#     ./scripts/mac-postbuild.sh path/to.app  # указать путь явно
# ============================================================

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ──────────────────────────────────────────────
# Определяем путь к .app
# ──────────────────────────────────────────────
APP_PATH="${1:-}"

if [ -z "$APP_PATH" ]; then
  # Авто-поиск в release/
  APP_PATH=$(find release -name "*.app" -maxdepth 3 -type d 2>/dev/null | head -1)
  if [ -z "$APP_PATH" ]; then
    error "Не найден .app в release/. Укажите путь явно:"
    error "  ./scripts/mac-postbuild.sh path/to/Для\ Коли.app"
    exit 1
  fi
fi

if [ ! -d "$APP_PATH" ]; then
  error "Путь не существует: $APP_PATH"
  exit 1
fi

info "Целевой .app: $APP_PATH"

# ──────────────────────────────────────────────
# Шаг 1: Ad-hoc подпись кода
# ──────────────────────────────────────────────
info "Накладываем ad-hoc подпись кода (codesign --sign -)..."
if codesign --sign - --force --deep --options runtime "$APP_PATH" 2>/dev/null; then
  info "Ad-hoc подпись успешно наложена"
else
  warn "codesign --sign - не удался, пробуем без --options runtime..."
  if codesign --sign - --force --deep "$APP_PATH" 2>/dev/null; then
    info "Ad-hoc подпись наложена (без hardened runtime)"
  else
    warn "Не удалось наложить ad-hoc подпись. Приложение может блокироваться Gatekeeper."
    warn "Для подписи нужен Apple Developer ID. См. https://developer.apple.com"
  fi
fi

# ──────────────────────────────────────────────
# Шаг 2: Удаление quarantine-атрибута
# ──────────────────────────────────────────────
info "Удаляем quarantine-атрибут (xattr -cr)..."
if xattr -cr "$APP_PATH" 2>/dev/null; then
  info "Quarantine-атрибут удалён"
else
  warn "Не удалось удалить quarantine-атрибут (возможно, нет прав)"
fi

# ──────────────────────────────────────────────
# Шаг 3: Верификация подписи
# ──────────────────────────────────────────────
info "Верификация код-подписи..."
if codesign --verify --deep --strict "$APP_PATH" 2>/dev/null; then
  info "Код-подпись валидна ✓"
else
  warn "Код-подпись невалидна — приложение может блокироваться Gatekeeper"
  warn "Пользователю нужно будет: Системные настройки → Конфиденциальность → Разрешить"
fi

# ──────────────────────────────────────────────
# Шаг 4: Проверка архитектуры
# ──────────────────────────────────────────────
info "Проверяем архитектуру бинарника..."
BINARY_PATH="$APP_PATH/Contents/MacOS/Для Коли"
if [ ! -f "$BINARY_PATH" ]; then
  # Пробуем найти бинарник по имени
  BINARY_PATH=$(find "$APP_PATH/Contents/MacOS" -type f -perm +111 2>/dev/null | head -1)
fi

if [ -n "$BINARY_PATH" ] && [ -f "$BINARY_PATH" ]; then
  ARCH=$(file "$BINARY_PATH" 2>/dev/null | grep -o 'arm64\|x86_64\|universal' || echo "unknown")
  info "Архитектура бинарника: $ARCH"
  if echo "$ARCH" | grep -q "arm64\|universal"; then
    info "Бинарник совместим с Apple Silicon (M1/M2/M3) ✓"
  else
    warn "Бинарник НЕ arm64 — может работать через Rosetta 2 или не запуститься"
  fi
else
  warn "Не удалось найти бинарник для проверки архитектуры"
fi

# ──────────────────────────────────────────────
# Итог
# ──────────────────────────────────────────────
echo ""
info "=========================================="
info "  Пост-сборка завершена"
info "=========================================="
echo ""
info "Если приложение всё ещё не открывается:"
info "  1. Системные настройки → Конфиденциальность и защита"
info "  2. Прокрутите вниз → 'Приложения, загруженные не из App Store'"
info "  3. Нажмите 'Разрешить' рядом с приложением"
echo ""
info "Или через терминал:"
info "  xattr -cr '$APP_PATH'"
