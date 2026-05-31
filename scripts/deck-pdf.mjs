import { spawn, execFileSync, execSync } from "node:child_process";

const [slug, output = `${slug}.pdf`] = process.argv.slice(2);

if (!slug) {
  console.error("Usage: npx astromotion-pdf <slug> [output.pdf]");
  process.exit(1);
}

const url = `http://localhost:4321/decks/${slug}/`;

execSync("npx astro build", { stdio: "inherit" });

// `detached` puts the preview in its own process group so we can later kill the
// whole tree: `npx` spawns astro which spawns the real server, and signalling
// just the npx wrapper leaves the server (and its open handles) alive, hanging
// the script. `stdio: "ignore"` keeps an undrained pipe from filling during the
// long synchronous decktape run --- another way the script can wedge.
const server = spawn("npx", ["astro", "preview"], {
  stdio: "ignore",
  detached: true,
  env: { ...process.env, ASTRO_DISABLE_DEV_TOOLBAR: "true" },
});

const killServer = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
};
process.on("exit", killServer);

for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(url);
    if (res.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// decktape's `reveal` plugin can't drive astromotion decks: it requires a
// global `Reveal` exposing `availableFragments`, but astromotion initialises
// reveal.js 6 as an ES module and never puts it on `window`, so the plugin
// refuses to activate. We use the `generic` plugin instead, which navigates by
// key press (ArrowRight steps through fragments and slides) and stops once a
// frame repeats --- no Reveal API needed, so it's robust across reveal.js
// versions. Each frame is captured in its settled state, so auto-animate slides
// export correctly.
//
// Chrome handling is environment-specific, so it's configurable rather than
// hardcoded:
//   DECKTAPE_CHROME_PATH  path to a Chrome/Chromium binary
//                         (default: decktape's bundled Chromium, if installed)
//   DECKTAPE_CHROME_ARGS  comma-separated Chrome flags, e.g. "--no-sandbox"
//                         (needed in containers and some Linux setups)
//   DECKTAPE_MAX_SLIDES   safety cap on exported slides (default 500); generic
//                         stops at the last slide on its own
const chromePath = process.env.DECKTAPE_CHROME_PATH;
const chromeArgs = (process.env.DECKTAPE_CHROME_ARGS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const maxSlides = process.env.DECKTAPE_MAX_SLIDES ?? "500";

try {
  execFileSync(
    "npx",
    [
      "decktape",
      "generic",
      // `=` form throughout: decktape's parser otherwise reads a flag-like
      // value (e.g. `--chrome-arg --no-sandbox`) as the next option and bails.
      "--key=ArrowRight",
      `--max-slides=${maxSlides}`,
      "--size=1280x720",
      "--load-pause=5000",
      "--pause=2500",
      ...(chromePath ? [`--chrome-path=${chromePath}`] : []),
      ...chromeArgs.map((a) => `--chrome-arg=${a}`),
      url,
      output,
    ],
    { stdio: "inherit" },
  );
} finally {
  killServer();
}

// decktape (and its Chromium) can leave handles open that keep the event loop
// alive even after the PDF is written, so exit explicitly once it's done.
process.exit(0);
