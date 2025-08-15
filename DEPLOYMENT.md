# 🚀 Инструкция по деплою Moodboard на TimeWeb.Cloud

## 📋 Предварительные требования

- Доступ к серверу TimeWeb.Cloud с Ubuntu 18.04.6
- SSH доступ к серверу
- Домен (опционально, но рекомендуется)
- Git репозиторий с проектом

## 🖥️ Шаг 1: Подготовка сервера

### 1.1. Подключение к серверу
```bash
ssh username@your-server-ip
```

### 1.2. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3. Установка необходимого ПО
```bash
# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии
node --version
npm --version

# Установка PM2 для управления процессами
sudo npm install -g pm2

# Установка Nginx
sudo apt install nginx -y

# Установка Git
sudo apt install git -y

# Установка curl для health checks
sudo apt install curl -y

# Установка unzip для распаковки архивов
sudo apt install unzip -y
```

### 1.4. Настройка PM2 автозапуска
```bash
pm2 startup
# Следуйте инструкциям на экране
pm2 save
```

## 📁 Шаг 2: Создание структуры директорий

### 2.1. Создание директорий проекта
```bash
sudo mkdir -p /var/www/moodboard
sudo mkdir -p /var/www/backups
sudo mkdir -p /var/log/moodboard
sudo mkdir -p /var/log/nginx
```

### 2.2. Установка прав доступа
```bash
sudo chown -R www-data:www-data /var/www/moodboard
sudo chown -R www-data:www-data /var/www/backups
sudo chown -R www-data:www-data /var/log/moodboard
```

## 🔑 Шаг 3: Настройка SSH ключей

### 3.1. Генерация SSH ключей (на вашем компьютере)
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

### 3.2. Копирование публичного ключа на сервер
```bash
ssh-copy-id username@your-server-ip
```

### 3.3. Тестирование подключения
```bash
ssh username@your-server-ip
```

## 📥 Шаг 4: Клонирование проекта

### 4.1. Клонирование репозитория
```bash
cd /var/www
sudo git clone https://github.com/your-username/moodboard.git
sudo chown -R www-data:www-data moodboard
cd moodboard
```

### 4.2. Установка зависимостей
```bash
npm ci --only=production
```

### 4.3. Создание файла переменных окружения
```bash
cp env.example .env
nano .env
# Заполните реальными значениями
```

## ⚙️ Шаг 5: Настройка Nginx

### 5.1. Копирование конфигурации
```bash
sudo cp nginx.conf /etc/nginx/sites-available/moodboard
```

### 5.2. Редактирование конфигурации
```bash
sudo nano /etc/nginx/sites-available/moodboard
# Замените your-domain.com на ваш реальный домен
```

### 5.3. Активация сайта
```bash
sudo ln -s /etc/nginx/sites-available/moodboard /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🚀 Шаг 6: Первый запуск

### 6.1. Сборка проекта
```bash
cd /var/www/moodboard
npm run build
```

### 6.2. Запуск с PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 6.3. Проверка статуса
```bash
pm2 status
pm2 logs moodboard
```

## 🔄 Шаг 7: Настройка автоматического деплоя

### 7.1. Создание скрипта деплоя
```bash
sudo cp deploy.sh /var/www/
sudo chmod +x /var/www/deploy.sh
sudo chown www-data:www-data /var/www/deploy.sh
```

### 7.2. Тестирование скрипта
```bash
cd /var/www
./deploy.sh
```

## 🌐 Шаг 8: Настройка домена и SSL

### 8.1. Настройка DNS
- В панели TimeWeb.Cloud добавьте A-запись на IP вашего сервера
- Или у вашего регистратора доменов

### 8.2. Установка SSL сертификата
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте строку:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Шаг 9: Мониторинг и логи

### 9.1. Просмотр логов PM2
```bash
pm2 logs moodboard
pm2 monit
```

### 9.2. Просмотр логов Nginx
```bash
sudo tail -f /var/log/nginx/moodboard_access.log
sudo tail -f /var/log/nginx/moodboard_error.log
```

### 9.3. Просмотр логов приложения
```bash
sudo tail -f /var/log/moodboard/deploy.log
```

## 🔧 Шаг 10: Настройка GitHub Actions

### 10.1. Добавление секретов в GitHub
В настройках репозитория GitHub → Secrets and variables → Actions добавьте:

- `TIMEWEB_HOST` - IP адрес вашего сервера
- `TIMEWEB_USERNAME` - имя пользователя на сервере
- `TIMEWEB_SSH_KEY` - приватный SSH ключ

### 10.2. Тестирование CI/CD
Сделайте push в ветку main:
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

## 🚨 Шаг 11: Безопасность

### 11.1. Настройка файрвола
```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 11.2. Настройка SSH
```bash
sudo nano /etc/ssh/sshd_config
# Измените:
# Port 22 → Port 2222 (опционально)
# PermitRootLogin no
# PasswordAuthentication no

sudo systemctl restart ssh
```

## 📈 Шаг 12: Оптимизация

### 12.1. Настройка swap файла
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 12.2. Настройка Nginx кэширования
```bash
sudo nano /etc/nginx/nginx.conf
# Добавьте в http блок:
# proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=STATIC:10m inactive=7d use_temp_path=off;
```

## 🔍 Шаг 13: Тестирование

### 13.1. Проверка доступности
```bash
curl -I http://localhost:3000
curl -I http://your-domain.com
```

### 13.2. Проверка SSL
```bash
curl -I https://your-domain.com
```

### 13.3. Проверка производительности
```bash
# Установка Apache Bench
sudo apt install apache2-utils -y

# Тест производительности
ab -n 1000 -c 10 http://your-domain.com/
```

## 🚨 Устранение неполадок

### Проблема: Приложение не запускается
```bash
pm2 logs moodboard
pm2 show moodboard
sudo journalctl -u nginx -f
```

### Проблема: Nginx не работает
```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx -f
```

### Проблема: Порт занят
```bash
sudo netstat -tlnp | grep :3000
sudo lsof -i :3000
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs moodboard`
2. Проверьте статус: `pm2 status`
3. Проверьте Nginx: `sudo systemctl status nginx`
4. Проверьте файрвол: `sudo ufw status`

## 🎉 Поздравляем!

Ваш Moodboard проект успешно развернут на TimeWeb.Cloud!

**Следующие шаги:**
- Настройте мониторинг
- Настройте бэкапы
- Настройте алерты
- Оптимизируйте производительность
