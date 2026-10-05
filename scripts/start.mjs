// Serve the production build only on this computer.
process.env.HOST = "127.0.0.1";
process.env.NITRO_HOST = "127.0.0.1";
process.env.PORT ??= "3000";
process.env.NITRO_PORT ??= process.env.PORT;

await import("../.output/server/index.mjs");
