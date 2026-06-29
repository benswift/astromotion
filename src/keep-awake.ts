// Hold the display awake while a deck is presented fullscreen.
//
// Laptops dim and sleep the screen on an idle timer, and a presentation goes
// minutes at a time with no pointer or keyboard activity --- so the display
// sleeps mid-slide. The Screen Wake Lock API keeps it on. We scope the lock to
// fullscreen: that's when a deck is actually being shown, and entering
// fullscreen is a user gesture, which is exactly what the API needs to grant
// the request.
//
// The browser releases the lock automatically when the page is hidden (tab
// switch, minimise), so we re-request it when the page returns to the
// foreground while still fullscreen. Best-effort throughout: unsupported
// browsers and rejected requests fail silently and fall back to the OS idle
// behaviour.

export function keepAwakeInFullscreen(): void {
  if (!("wakeLock" in navigator)) return;

  let lock: WakeLockSentinel | null = null;

  const acquire = async () => {
    if (lock || !document.fullscreenElement || document.visibilityState !== "visible") {
      return;
    }
    try {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => {
        lock = null;
      });
    } catch {
      // Unsupported or rejected (e.g. no user activation) --- leave it to the OS.
    }
  };

  const release = async () => {
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      // Already released.
    }
    lock = null;
  };

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) void acquire();
    else void release();
  });
  document.addEventListener("visibilitychange", () => void acquire());
}
