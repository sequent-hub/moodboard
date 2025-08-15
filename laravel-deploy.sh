#!/bin/bash
# laravel-deploy.sh - Скрипт деплоя для Laravel + Moodboard проекта

set -e  # Останавливаем выполнение при ошибке

echo "🚀 Starting deployment of Laravel + Moodboard project..."

# Переменные
PROJECT_DIR="/var/www/miro"
BACKUP_DIR="/var/www/backups"
LOG_FILE="/var/log/miro/deploy.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Создаем директории если их нет
sudo mkdir -p $PROJECT_DIR
sudo mkdir -p $BACKUP_DIR
sudo mkdir -p /var/log/miro

# Устанавливаем права
sudo chown -R www-data:www-data $PROJECT_DIR
sudo chown -R www-data:www-data $BACKUP_DIR
sudo chown -R www-data:www-data /var/log/miro

# Логируем начало деплоя
echo "[$TIMESTAMP] Deployment started" | sudo tee -a $LOG_FILE

# Останавливаем приложение если запущено
if pm2 list | grep -q "miro"; then
    echo "⏹️ Stopping Laravel application..."
    pm2 stop miro
    echo "[$TIMESTAMP] Application stopped" | sudo tee -a $LOG_FILE
fi

# Создаем бэкап текущей версии
if [ -d "$PROJECT_DIR/app" ]; then
    echo "💾 Creating backup of current version..."
    sudo tar -czf "$BACKUP_DIR/miro_backup_$TIMESTAMP.tar.gz" -C $PROJECT_DIR .
    echo "[$TIMESTAMP] Backup created: miro_backup_$TIMESTAMP.tar.gz" | sudo tee -a $LOG_FILE
fi

# Переходим в директорию проекта
cd $PROJECT_DIR

# Получаем последние изменения
echo "📥 Pulling latest changes from Git..."
git fetch origin
git reset --hard origin/main
echo "[$TIMESTAMP] Git updated" | sudo tee -a $LOG_FILE

# Устанавливаем PHP зависимости
echo "📦 Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader
echo "[$TIMESTAMP] Composer dependencies installed" | sudo tee -a $LOG_FILE

# Устанавливаем Node.js зависимости
echo "📦 Installing Node.js dependencies..."
npm ci --only=production
echo "[$TIMESTAMP] NPM dependencies installed" | sudo tee -a $LOG_FILE

# Собираем Moodboard
echo "🔨 Building Moodboard..."
npm run build
echo "[$TIMESTAMP] Moodboard built" | sudo tee -a $LOG_FILE

# Собираем Laravel assets
echo "🔨 Building Laravel assets..."
npm run build
echo "[$TIMESTAMP] Laravel assets built" | sudo tee -a $LOG_FILE

# Настройка Laravel
echo "⚙️ Configuring Laravel..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
echo "[$TIMESTAMP] Laravel configured" | sudo tee -a $LOG_FILE

# Устанавливаем права на storage и bootstrap/cache
echo "🔐 Setting permissions..."
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
echo "[$TIMESTAMP] Permissions set" | sudo tee -a $LOG_FILE

# Запускаем приложение
echo "▶️ Starting application..."
pm2 start ecosystem.config.js --env production
pm2 save
echo "[$TIMESTAMP] Application started" | sudo tee -a $LOG_FILE

# Проверяем статус
echo "📊 Application status:"
pm2 status miro

# Проверяем доступность
echo "🔍 Checking application availability..."
sleep 10
if curl -f http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ Application is running successfully!"
    echo "[$TIMESTAMP] Deployment completed successfully" | sudo tee -a $LOG_FILE
else
    echo "❌ Application failed to start!"
    echo "[$TIMESTAMP] Deployment failed - application not responding" | sudo tee -a $LOG_FILE
    exit 1
fi

# Очищаем старые бэкапы (оставляем последние 5)
echo "🧹 Cleaning old backups..."
cd $BACKUP_DIR
ls -t miro_backup_*.tar.gz | tail -n +6 | xargs -r rm
echo "[$TIMESTAMP] Old backups cleaned" | sudo tee -a $LOG_FILE

echo "🎉 Deployment completed successfully!"
echo "📝 Logs saved to: $LOG_FILE"
echo "🔄 Application restarted and running"
