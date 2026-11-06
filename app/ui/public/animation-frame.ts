/**
 * Runs `callback` at most once per animation frame, however often `request`
 * is called before that frame. `cancel` drops a pending run.
 */
export function throttleToAnimationFrame(callback: () => void) {
  let frame = 0;
  return {
    request: () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        callback();
      });
    },
    cancel: () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
