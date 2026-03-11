import { spawn, execFileSync, execSync } from "node:child_process";

const [slug, output = `${slug}.pdf`] = process.argv.slice(2);

if (!slug) {
  console.error("Usage: npx astromotion-pdf <slug> [output.pdf]");
  process.exit(1);
}

const url = `http://localhost:4321/decks/${slug}/`;

execSync("npx astro build", { stdio: "inherit" });

const server = spawn("npx", ["astro", "preview"], {
  stdio: "pipe",
  env: { ...process.env, ASTRO_DISABLE_DEV_TOOLBAR: "true" },
});

process.on("exit", () => server.kill());

for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(url);
    if (res.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

try {
  execFileSync(
    "npx",
    ["decktape", "reveal", "--size", "1280x720", "--load-pause", "5000", "--pause", "4000", url, output],
    { stdio: "inherit" },
  );
} finally {
  server.kill();
}
