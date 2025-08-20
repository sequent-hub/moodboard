# Настройка Ubuntu сервера для CI/CD деплоя

## 🚀 Быстрая настройка (выполнить по порядку)

### 1. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 2. Node.js и npm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g yarn pm2 nodemon
```

### 3. PHP 8.2 и Composer
```bash
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.2 php8.2-cli php8.2-fpm php8.2-mysql php8.2-pgsql php8.2-sqlite3 php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd php8.2-bcmath php8.2-intl php8.2-redis php8.2-memcached
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
```

### 4. База данных (MySQL)
```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
sudo mysql -u root -p
# В MySQL консоли:
CREATE USER 'devuser'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON *.* TO 'devuser'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

### 5. Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6. Git и SSH
```bash
git config --global user.name "your-github-username"
git config --global user.email "your-email@example.com"
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# Скопировать ключ и добавить в GitHub Settings → SSH and GPG keys
```

### 7. SSH конфиг
```bash
mkdir -p ~/.ssh
nano ~/.ssh/config
```
Содержимое файла:
```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

### 8. GitHub CLI
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
nano /etc/apt/sources.list.d/github-cli.list
# Добавить: deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main
sudo apt update
sudo apt install gh
```

### 9. Docker (опционально)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 10. Безопасность
```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw allow 8000
sudo ufw enable
```

### 11. Пользователь для деплоя
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

## ✅ Проверка установки
```bash
echo "=== Node.js ===" && node --version && npm --version
echo "=== PHP ===" && php --version && composer --version
echo "=== MySQL ===" && mysql --version
echo "=== Nginx ===" && nginx -v
echo "=== Git ===" && git --version
echo "=== SSH ===" && ssh -T git@github.com
```

## 📁 Nginx конфиг для Laravel
```bash
sudo nano /etc/nginx/sites-available/laravel
```
Содержимое:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html/public;
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

Активировать:
```bash
sudo ln -s /etc/nginx/sites-available/laravel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🚀 Готово!
Сервер настроен для:
- Node.js приложений
- Laravel проектов
- CI/CD деплоя через GitHub Actions
- Автоматического деплоя при push в main/master

## 📋 Следующие шаги:
1. Настроить GitHub Actions workflow
2. Настроить автоматический деплой
3. Настроить домен (если есть)
4. Настроить SSL сертификаты
```

Теперь файл `server-setup.md` создан! Давайте проверим, что он появился:
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
