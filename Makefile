.PHONY: dev build preview install clean commit push deploy all up \
       electron-dev electron-build electron-preview \
       electron-build-mac electron-build-linux electron-build-all \
       electron-mac-fix

# ──────────────────────────────────────────────
# Разработка (веб)
# ──────────────────────────────────────────────

# Запуск dev-сервера
dev:
	npx vite --host 0.0.0.0

# Сборка для production (веб)
build:
	npx vite build

# Предпросмотр production сборки
preview:
	npx vite preview --host 0.0.0.0

# Установка зависимостей
install:
	npm install

# Очистка зависимостей и сборки
clean:
	rm -rf node_modules dist dist-electron release

# ──────────────────────────────────────────────
# Git: коммит, пуш, деплой
# ──────────────────────────────────────────────

# Коммит с сообщением: make commit msg="описание изменений"
commit:
	git add -A
	git commit -m "$(msg)"

# Пуш в текущую ветку
push:
	git push

# Деплой на GitHub Pages (сборка + публикация в gh-pages ветку)
deploy:
	npm run deploy

# Полный цикл: коммит → пуш → деплой
# Использование: make all msg="описание изменений"
all: commit push deploy

# ──────────────────────────────────────────────
# Electron: разработка и сборка десктоп-приложения
# ──────────────────────────────────────────────

# Запуск Electron в режиме разработки (hot reload)
electron-dev:
	npm run electron:dev

# Сборка десктоп-приложения для текущей платформы
electron-build:
	npm run electron:build

# Предпросмотр Electron-сборки без упаковки
electron-preview:
	npm run electron:preview

# Сборка только для macOS (DMG + ZIP, Universal: Intel + Apple Silicon)
electron-build-mac:
	npm run electron:build:mac

# Сборка только для Linux (AppImage + DEB + tar.gz)
electron-build-linux:
	npm run electron:build:linux

# Сборка для macOS и Linux одновременно
electron-build-all:
	npm run electron:build:all

# Пост-сборка macOS: ad-hoc подпись + удаление quarantine
# Решает проблему "приложение повреждено" на macOS M1/M2/M3
electron-mac-fix:
	./scripts/mac-postbuild.sh
