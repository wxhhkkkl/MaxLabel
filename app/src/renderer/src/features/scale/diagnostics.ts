/** Sanitize raw serial frames for display; control bytes become visible dots. */
export function diagnosticFrames(frames: readonly string[], limit = 10): string[] {
  return frames.slice(0, limit).map((frame) => frame.replace(/[\u0000-\u001f\u007f]/g, '·'))
}
