module.exports = {
  apps: [
    {
      name: "hermes-hub",
      script: "C:\\Windows\\System32\\cmd.exe",
      args: "/c node_modules\\.bin\\tsx.cmd server.ts",
      interpreter: "none",
      cwd: "c:/Users/profs/Documents/Hermes/hermes-hub",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
