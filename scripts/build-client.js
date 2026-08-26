const path = require("node:path");
const { build } = require("esbuild");

async function buildClient(rootDir, distDir) {
  await build({
    entryPoints: {
      "firebase-public": path.join(rootDir, "src", "firebase-public.js"),
      "home-editor": path.join(rootDir, "src", "home-editor.js"),
      "interest-editor": path.join(rootDir, "src", "interest-editor.js"),
      admin: path.join(rootDir, "src", "admin.js"),
    },
    outdir: path.join(distDir, "client"),
    bundle: true,
    chunkNames: "chunks/[name]-[hash]",
    entryNames: "[name]",
    format: "esm",
    splitting: true,
    minify: true,
    sourcemap: false,
    target: ["es2022"],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    logLevel: "warning",
  });
}

module.exports = { buildClient };
