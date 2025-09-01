// PM2 Ecosystem Configuration for IFHE Campus Assistant Portal
module.exports = {
  apps: [
    {
      name: 'ifhe-campus-assistant',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false, // Disable PM2 file monitoring (Wrangler handles hot reload)
      instances: 1, // Single instance for development
      exec_mode: 'fork',
      max_memory_restart: '1G',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      autorestart: true,
      restart_delay: 1000
    }
  ]
};