#!/bin/bash
# deploy.sh - Скрипт деплоя для Moodboard проекта

set -e  # Останавливаем выполнение при ошибке

echo "🚀 Starting deployment of Moodboard project..."

# Переменные
PROJECT_DIR="/var/www/moodboard"
BACKUP_DIR="/var/www/backups"
LOG_FILE="/var/log/moodboard/deploy.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Создаем директории если их нет
sudo mkdir -p $PROJECT_DIR
sudo mkdir -p $BACKUP_DIR
sudo mkdir -p /var/log/moodboard

# Устанавливаем права
sudo chown -R www-data:www-data $PROJECT_DIR
sudo chown -R www-data:www-data $BACKUP_DIR
sudo chown -R www-data:www-data /var/log/moodboard

# Логируем начало деплоя
echo "[$TIMESTAMP] Deployment started" | sudo tee -a $LOG_FILE

# Останавливаем приложение если запущено
if pm2 list | grep -q "moodboard"; then
    echo "⏹️ Stopping Moodboard application..."
    pm2 stop moodboard
    echo "[$TIMESTAMP] Application stopped" | sudo tee -a $LOG_FILE
fi

# Создаем бэкап текущей версии
if [ -d "$PROJECT_DIR/src" ]; then
    echo "💾 Creating backup of current version..."
    sudo tar -czf "$BACKUP_DIR/moodboard_backup_$TIMESTAMP.tar.gz" -C $PROJECT_DIR .
    echo "[$TIMESTAMP] Backup created: moodboard_backup_$TIMESTAMP.tar.gz" | sudo tee -a $LOG_FILE
fi

# Переходим в директорию проекта
cd $PROJECT_DIR

# Получаем последние изменения
echo "📥 Pulling latest changes from Git..."
git fetch origin
git reset --hard origin/main
echo "[$TIMESTAMP] Git updated" | sudo tee -a $LOG_FILE

# Устанавливаем зависимости
echo "📦 Installing dependencies..."
npm ci --only=production
echo "[$TIMESTAMP] Dependencies installed" | sudo tee -a $LOG_FILE

# Собираем проект
echo "🔨 Building project..."
npm run build
echo "[$TIMESTAMP] Project built" | sudo tee -a $LOG_FILE

# Запускаем приложение
echo "▶️ Starting application..."
pm2 start ecosystem.config.js --env production
pm2 save
echo "[$TIMESTAMP] Application started" | sudo tee -a $LOG_FILE

# Проверяем статус
echo "📊 Application status:"
pm2 status moodboard

# Проверяем доступность
echo "🔍 Checking application availability..."
sleep 5
if curl -f http://localhost:3000 > /dev/null 2>&1; then
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
ls -t moodboard_backup_*.tar.gz | tail -n +6 | xargs -r rm
echo "[$TIMESTAMP] Old backups cleaned" | sudo tee -a $LOG_FILE

echo "🎉 Deployment completed successfully!"
echo "📝 Logs saved to: $LOG_FILE"
echo "🔄 Application restarted and running"
