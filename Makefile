.PHONY: dev build preview install clean up

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
