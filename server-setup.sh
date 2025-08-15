#!/bin/bash
# server-setup.sh - Автоматическая настройка сервера для Moodboard проекта

set -e  # Останавливаем выполнение при ошибке

echo "🚀 Начинаем автоматическую настройку сервера для Moodboard..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Проверка на root права
if [ "$EUID" -eq 0 ]; then
    error "Не запускайте скрипт от root пользователя!"
fi

# Переменные
PROJECT_NAME="moodboard"
PROJECT_DIR="/var/www/$PROJECT_NAME"
BACKUP_DIR="/var/www/backups"
LOG_DIR="/var/log/$PROJECT_NAME"
NGINX_SITE="moodboard"

log "Настройка переменных окружения..."
export DEBIAN_FRONTEND=noninteractive

log "Обновление системы..."
sudo apt update && sudo apt upgrade -y

log "Установка необходимых пакетов..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

log "Установка Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

log "Проверка версий Node.js и npm..."
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "Node.js: $NODE_VERSION, npm: $NPM_VERSION"

log "Установка PM2 глобально..."
sudo npm install -g pm2

log "Установка Nginx..."
sudo apt install -y nginx

log "Установка дополнительных утилит..."
sudo apt install -y curl htop tree

log "Создание структуры директорий..."
sudo mkdir -p $PROJECT_DIR
sudo mkdir -p $BACKUP_DIR
sudo mkdir -p $LOG_DIR
sudo mkdir -p /var/log/nginx

log "Установка прав доступа..."
sudo chown -R www-data:www-data $PROJECT_DIR
sudo chown -R www-data:www-data $BACKUP_DIR
sudo chown -R www-data:www-data $LOG_DIR

log "Настройка PM2 автозапуска..."
pm2 startup
log "PM2 startup настроен. Не забудьте выполнить команду, которую покажет PM2!"

log "Настройка Nginx..."
# Создание конфигурации Nginx
sudo tee /etc/nginx/sites-available/$NGINX_SITE > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    # Логи
    access_log /var/log/nginx/${PROJECT_NAME}_access.log;
    error_log /var/log/nginx/${PROJECT_NAME}_error.log;
    
    # Основное приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Статические файлы
    location /static/ {
        alias $PROJECT_DIR/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
}
EOF

log "Активация Nginx сайта..."
sudo ln -sf /etc/nginx/sites-available/$NGINX_SITE /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

log "Проверка конфигурации Nginx..."
sudo nginx -t

log "Перезапуск Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

log "Настройка файрвола..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

log "Создание swap файла..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    log "Swap файл создан (2GB)"
else
    log "Swap файл уже существует"
fi

log "Настройка системных параметров..."
# Увеличение лимитов файлов
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Настройка sysctl для производительности
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# Настройки для Node.js
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 2000000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_tw_recycle = 0
EOF

sudo sysctl -p

log "Создание скрипта деплоя..."
sudo tee /var/www/deploy.sh > /dev/null <<'EOF'
#!/bin/bash
# deploy.sh - Скрипт деплоя для Moodboard проекта

set -e

echo "🚀 Starting deployment of Moodboard project..."

PROJECT_DIR="/var/www/moodboard"
BACKUP_DIR="/var/www/backups"
LOG_FILE="/var/log/moodboard/deploy.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "[$TIMESTAMP] Deployment started" | sudo tee -a $LOG_FILE

if pm2 list | grep -q "moodboard"; then
    echo "⏹️ Stopping Moodboard application..."
    pm2 stop moodboard
fi

if [ -d "$PROJECT_DIR/src" ]; then
    echo "💾 Creating backup..."
    sudo tar -czf "$BACKUP_DIR/moodboard_backup_$TIMESTAMP.tar.gz" -C $PROJECT_DIR .
fi

cd $PROJECT_DIR

echo "📥 Pulling latest changes..."
git fetch origin
git reset --hard origin/main

echo "📦 Installing dependencies..."
npm ci --only=production

echo "🔨 Building project..."
npm run build

echo "▶️ Starting application..."
pm2 start ecosystem.config.js --env production
pm2 save

echo "📊 Application status:"
pm2 status moodboard

echo "🔍 Checking availability..."
sleep 5
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Application is running successfully!"
    echo "[$TIMESTAMP] Deployment completed successfully" | sudo tee -a $LOG_FILE
else
    echo "❌ Application failed to start!"
    exit 1
fi

cd $BACKUP_DIR
ls -t moodboard_backup_*.tar.gz | tail -n +6 | xargs -r rm

echo "🎉 Deployment completed successfully!"
EOF

sudo chmod +x /var/www/deploy.sh
sudo chown www-data:www-data /var/www/deploy.sh

log "Настройка cron для автоматических бэкапов..."
# Создание cron задачи для ежедневных бэкапов
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/deploy.sh >> /var/log/moodboard/cron.log 2>&1") | crontab -

log "Создание файла .env.example..."
sudo tee $PROJECT_DIR/env.example > /dev/null <<EOF
# Переменные окружения для Moodboard проекта
NODE_ENV=production
PORT=3000

# Настройки безопасности
JWT_SECRET=your_super_secret_jwt_key_here
SESSION_SECRET=your_session_secret_here

# Настройки файлов
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Настройки логирования
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF

log "Настройка логирования..."
sudo tee /etc/logrotate.d/$PROJECT_NAME > /dev/null <<EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF

log "Проверка статуса сервисов..."
echo "📊 Статус сервисов:"
sudo systemctl status nginx --no-pager -l
pm2 status

log "Создание файла README для сервера..."
sudo tee $PROJECT_DIR/SERVER_README.md > /dev/null <<EOF
# 🖥️ Инструкция по управлению сервером Moodboard

## 📁 Структура директорий
- Проект: $PROJECT_DIR
- Бэкапы: $BACKUP_DIR
- Логи: $LOG_DIR

## 🚀 Команды управления

### PM2 (управление приложением)
\`\`\`bash
pm2 status                    # Статус приложения
pm2 logs moodboard           # Просмотр логов
pm2 monit                    # Мониторинг в реальном времени
pm2 restart moodboard        # Перезапуск приложения
pm2 stop moodboard           # Остановка приложения
\`\`\`

### Nginx
\`\`\`bash
sudo nginx -t                # Проверка конфигурации
sudo systemctl restart nginx # Перезапуск Nginx
sudo systemctl status nginx  # Статус Nginx
\`\`\`

### Деплой
\`\`\`bash
cd /var/www
./deploy.sh                  # Автоматический деплой
\`\`\`

### Логи
\`\`\`bash
sudo tail -f $LOG_DIR/deploy.log           # Логи деплоя
sudo tail -f /var/log/nginx/${PROJECT_NAME}_access.log  # Логи доступа
sudo tail -f /var/log/nginx/${PROJECT_NAME}_error.log   # Логи ошибок
\`\`\`

## 🔧 Полезные команды

### Мониторинг системы
\`\`\`bash
htop                        # Мониторинг процессов
df -h                       # Использование диска
free -h                     # Использование памяти
\`\`\`

### Сетевые соединения
\`\`\`bash
sudo netstat -tlnp          # Активные соединения
sudo lsof -i :3000          # Что использует порт 3000
\`\`\`

## 🚨 Устранение неполадок

1. **Приложение не запускается**: \`pm2 logs moodboard\`
2. **Nginx не работает**: \`sudo systemctl status nginx\`
3. **Порт занят**: \`sudo lsof -i :3000\`
4. **Проблемы с правами**: \`sudo chown -R www-data:www-data $PROJECT_DIR\`

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи приложения: \`pm2 logs moodboard\`
2. Логи Nginx: \`sudo journalctl -u nginx -f\`
3. Статус сервисов: \`pm2 status\` и \`sudo systemctl status nginx\`
EOF

log "Настройка завершена! 🎉"

echo ""
echo "=========================================="
echo "✅ НАСТРОЙКА СЕРВЕРА ЗАВЕРШЕНА УСПЕШНО!"
echo "=========================================="
echo ""
echo "📋 Что было настроено:"
echo "   • Node.js 18.x"
echo "   • PM2 для управления процессами"
echo "   • Nginx как reverse proxy"
echo "   • Файрвол UFW"
echo "   • Swap файл (2GB)"
echo "   • Автоматические бэкапы"
echo "   • Логирование и ротация логов"
echo "   • Скрипт автоматического деплоя"
echo ""
echo "🚀 Следующие шаги:"
echo "   1. Склонируйте ваш проект в $PROJECT_DIR"
echo "   2. Настройте переменные окружения (.env)"
echo "   3. Запустите приложение: npm run build && pm2 start ecosystem.config.js"
echo "   4. Настройте домен и SSL (опционально)"
echo ""
echo "📚 Документация сохранена в $PROJECT_DIR/SERVER_README.md"
echo "🔧 Скрипт деплоя: /var/www/deploy.sh"
echo ""
echo "⚠️  ВАЖНО: Выполните команду PM2 startup, которую покажет система!"
echo ""
