import { useEffect, useRef } from "react";

/**
 * Polling interval with two non-obvious behaviors callers should know about:
 *   - Skips the tick when the tab is hidden (document.hidden) so background
 *     tabs stop burning CPU and hitting the network.
 *   - Keeps the latest callback ref-stable, so callers can pass an inline
 *     closure without retriggering the interval on every render.
 *
 * Pass `delay = null` to pause the loop. The cleanup runs and a fresh
 * interval starts when delay changes.
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      savedCallback.current();
    };

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
