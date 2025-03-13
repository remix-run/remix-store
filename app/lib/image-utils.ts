/**
 * Extracts focal point coordinates from image presentation data
 */
export function getFocalPoint(
  presentation: unknown,
): { x: number; y: number } | undefined {
  if (typeof presentation !== "object" || presentation === null) {
    return undefined;
  }

  if (!("focalPoint" in presentation)) {
    return undefined;
  }

  const focalPoint = presentation.focalPoint;
  if (typeof focalPoint !== "object" || focalPoint === null) {
    return undefined;
  }

  if (!("x" in focalPoint) || !("y" in focalPoint)) {
    return undefined;
  }

  const x = Number(focalPoint.x);
  const y = Number(focalPoint.y);

  if (isNaN(x) || isNaN(y)) {
    return undefined;
  }

  return { x, y };
}
