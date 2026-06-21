/**
 * ORBIT API — PM2 ecosystem file (process manager)
 *
 * Use:  pm2 start ecosystem.config.cjs
 *       pm2 save    # persist across reboots
 *       pm2 startup # generate systemd/upstart service
 *
 * Why PM2: battle-tested, zero-downtime reloads, cluster mode, log rotation,
 * monitoring dashboard (pm2.io), graceful shutdown. Alternatives: systemd, Docker.
 */

module.exports = {
  apps: [
    {
      name: 'orbit-api',
      script: './apps/api/src/main.ts',
      interpreter: 'node',
      interpreter_args: '--require ts-node/register --require tsconfig-paths/register',
      instances: process.env.PM2_INSTANCES || 1,  // 'max' for cluster mode
      exec_mode: process.env.PM2_CLUSTER === 'true' ? 'cluster' : 'fork',
      max_memory_restart: '1G',
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,                 // wait 5s for graceful shutdown
      wait_ready: false,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Load .env.production if present
      node_args: ['--max-old-space-size=2048'],
      out_file: './logs/api-out.log',
      error_file: './logs/api-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Health check via HTTP (requires @nestjs/terminus /health)
      // pm2 will restart if health check fails
    },
  ],
};
