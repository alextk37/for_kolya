.PHONY: dev build preview install clean commit push deploy all up

# ──────────────────────────────────────────────
# Разработка
# ──────────────────────────────────────────────

# Запуск dev-сервера
dev:
	npx vite --host 0.0.0.0

# Сборка для production
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
	rm -rf node_modules dist

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
