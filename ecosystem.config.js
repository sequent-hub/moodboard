// ecosystem.config.js для PM2
module.exports = {
  apps: [{
    name: 'moodboard',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/moodboard',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Логирование
    log_file: '/var/log/moodboard/combined.log',
    out_file: '/var/log/moodboard/out.log',
    error_file: '/var/log/moodboard/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Автоперезапуск
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    
    // Мониторинг
    min_uptime: '10s',
    max_restarts: 10,
    
    // Переменные окружения
    env_file: '.env'
  }]
};
