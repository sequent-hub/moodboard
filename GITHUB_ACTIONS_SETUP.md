# 🔄 Настройка GitHub Actions для автоматического деплоя

## 📋 Что это дает?

- **Автоматическое тестирование** при каждом push
- **Автоматический деплой** на сервер при push в `main`
- **Откат к предыдущей версии** при ошибках
- **Логирование** всех операций

## 🚀 Быстрая настройка (5 минут)

### 1️⃣ Добавьте секреты в GitHub

1. Перейдите в ваш репозиторий на GitHub
2. Нажмите **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Добавьте следующие секреты:

#### **TIMEWEB_HOST**
```
Значение: IP адрес вашего сервера TimeWeb.Cloud
Пример: 123.456.789.012
```

#### **TIMEWEB_USERNAME**
```
Значение: имя пользователя на сервере
Пример: root
```

#### **TIMEWEB_SSH_KEY**
```
Значение: ваш приватный SSH ключ (весь файл)
Пример: -----BEGIN OPENSSH PRIVATE KEY-----
         b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
         ... (весь ключ)
         -----END OPENSSH PRIVATE KEY-----
```

### 2️⃣ Генерация SSH ключей (если нет)

```bash
# На вашем компьютере
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Копирование публичного ключа на сервер
ssh-copy-id username@your-server-ip

# Просмотр приватного ключа (скопируйте весь файл)
cat ~/.ssh/id_rsa
```

### 3️⃣ Активация GitHub Actions

1. Сделайте push в ветку `main`:
```bash
git add .
git commit -m "Add GitHub Actions deployment"
git push origin main
```

2. Перейдите в **Actions** на GitHub
3. Увидите запущенный workflow "Deploy to TimeWeb.Cloud"

## 🔍 Как это работает?

### Workflow запускается при:
- ✅ Push в ветку `main`
- ✅ Pull Request в ветку `main`

### Последовательность действий:
1. **Тестирование** - запуск всех тестов
2. **Сборка** - создание production версии
3. **Деплой** - автоматическое обновление на сервере

## 📊 Мониторинг деплоя

### В GitHub:
- **Actions** → выберите workflow → **View run**
- **Logs** - детальные логи каждого шага
- **Status** - успех/неудача деплоя

### На сервере:
```bash
# Логи деплоя
sudo tail -f /var/log/moodboard/deploy.log

# Статус приложения
pm2 status moodboard

# Логи приложения
pm2 logs moodboard
```

## 🚨 Устранение неполадок

### Ошибка: "Permission denied (publickey)"
```
❌ ERROR: Permission denied (publickey)
```
**Решение:**
1. Проверьте SSH ключ в секретах GitHub
2. Убедитесь, что публичный ключ добавлен на сервер
3. Проверьте права доступа: `ls -la ~/.ssh/`

### Ошибка: "Connection refused"
```
❌ ERROR: connect ECONNREFUSED
```
**Решение:**
1. Проверьте IP адрес в `TIMEWEB_HOST`
2. Убедитесь, что сервер доступен: `ping your-server-ip`
3. Проверьте файрвол: `sudo ufw status`

### Ошибка: "Command failed"
```
❌ ERROR: Command failed: npm ci --only=production
```
**Решение:**
1. Проверьте логи на сервере: `pm2 logs moodboard`
2. Убедитесь, что Node.js установлен: `node --version`
3. Проверьте права доступа: `sudo chown -R www-data:www-data /var/www/moodboard`

## 🔧 Ручной деплой (если нужно)

Если автоматический деплой не работает:

```bash
# На сервере
cd /var/www
./deploy.sh
```

## 📈 Расширенные настройки

### Добавление уведомлений в Slack/Discord:
```yaml
# В .github/workflows/deploy.yml добавьте:
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    channel: '#deployments'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Добавление проверки health check:
```yaml
# В .github/workflows/deploy.yml добавьте:
- name: Health Check
  run: |
    sleep 30
    curl -f http://${{ secrets.TIMEWEB_HOST }}/health || exit 1
```

## 🎯 Лучшие практики

### 1. **Всегда тестируйте локально:**
```bash
npm test
npm run build
```

### 2. **Используйте feature branches:**
```bash
git checkout -b feature/new-feature
# работайте над фичей
git push origin feature/new-feature
# создайте Pull Request
```

### 3. **Мониторьте логи:**
```bash
# На сервере
pm2 monit
sudo tail -f /var/log/nginx/moodboard_access.log
```

### 4. **Регулярные бэкапы:**
```bash
# Автоматически каждый день в 2:00
# Ручной бэкап:
cd /var/www/backups
sudo tar -czf moodboard_manual_$(date +%Y%m%d_%H%M%S).tar.gz -C /var/www/moodboard .
```

## 🎉 Поздравляем!

Теперь у вас есть:
- ✅ **Автоматическое тестирование**
- ✅ **Автоматический деплой**
- ✅ **Мониторинг и логирование**
- ✅ **Быстрый откат к предыдущей версии**

**При каждом push в main ваш проект автоматически обновляется на сервере!** 🚀
