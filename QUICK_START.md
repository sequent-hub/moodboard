# 🚀 Быстрый старт деплоя Moodboard на TimeWeb.Cloud

## ⚡ 5 минут до запуска!

### 1️⃣ Подготовка проекта (локально)
```bash
# Добавьте все файлы в Git
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### 2️⃣ Подключение к серверу
```bash
ssh username@your-server-ip
```

### 3️⃣ Автоматическая настройка сервера
```bash
# Скачайте скрипт настройки
wget https://raw.githubusercontent.com/your-username/moodboard/main/server-setup.sh
chmod +x server-setup.sh
./server-setup.sh
```

### 4️⃣ Клонирование проекта
```bash
cd /var/www
sudo git clone https://github.com/your-username/moodboard.git
sudo chown -R www-data:www-data moodboard
cd moodboard
```

### 5️⃣ Первый запуск
```bash
# Установка зависимостей
npm ci --only=production

# Сборка проекта
npm run build

# Запуск приложения
pm2 start ecosystem.config.js --env production
pm2 save
```

## 🎯 Готово! Ваш проект доступен по адресу:
- **Локально**: http://localhost:3000
- **Через Nginx**: http://your-server-ip
- **По домену**: http://your-domain.com (если настроен)

## 🔄 Автоматический деплой
При каждом push в ветку `main` проект автоматически обновляется на сервере!

## 📚 Подробная документация
См. файл `DEPLOYMENT.md` для детальных инструкций.

## 🆘 Нужна помощь?
1. Проверьте логи: `pm2 logs moodboard`
2. Статус: `pm2 status`
3. Nginx: `sudo systemctl status nginx`
4. Документация: `/var/www/moodboard/SERVER_README.md`
