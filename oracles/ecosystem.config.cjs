// PM2 process manifest for the 5-node oracle swarm.
//
// Start   : pnpm/npm run swarm:start     (pm2 start ecosystem.config.cjs)
// Status  : pnpm/npm run swarm:status
// Logs    : pnpm/npm run swarm:logs
// Kill 1  : pm2 stop oracle-youtube-05   ← demo trick
// Revive  : pm2 restart oracle-youtube-05
// Stop all: pnpm/npm run swarm:stop
// Remove  : pnpm/npm run swarm:delete

const node = (name, script, color) => ({
  name,
  script: 'node_modules/.bin/tsx',
  args: script,
  cwd: __dirname,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 1500,
  watch: false,
  time: true,
  env: {
    NODE_ENV: 'development',
    PM2_COLOR: color,
  },
})

module.exports = {
  apps: [
    node('oracle-twitter-01', 'src/nodes/twitter/index.ts', 'cyan'),
    node('oracle-google-02',  'src/nodes/google/index.ts',  'yellow'),
    node('oracle-news-03',    'src/nodes/news/index.ts',    'magenta'),
    node('oracle-reddit-04',  'src/nodes/reddit/index.ts',  'green'),
    node('oracle-youtube-05', 'src/nodes/youtube/index.ts', 'red'),
  ],
}
