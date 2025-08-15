// ecosystem-laravel.config.js для PM2 (Laravel + Moodboard)
module.exports = {
  apps: [{
    name: 'miro',
    script: 'php',
    args: 'artisan serve --host=0.0.0.0 --port=8000',
    cwd: '/var/www/miro',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 8000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    // Логирование
    log_file: '/var/log/miro/combined.log',
    out_file: '/var/log/miro/out.log',
    error_file: '/var/log/miro/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Автоперезапуск
    watch: false,
    ignore_watch: ['node_modules', 'storage', 'bootstrap/cache', '*.log'],
    
    // Мониторинг
    min_uptime: '10s',
    max_restarts: 10,
    
    // Переменные окружения
    env_file: '.env',
    
    // Дополнительные настройки для Laravel
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
