export interface FocalPoint {
  x: number;
  y: number;
}

/** Extracts normalized focal-point coordinates from Shopify image presentation data. */
export function getFocalPoint(presentation: unknown): FocalPoint | undefined {
  if (typeof presentation !== "object" || presentation === null) {
    return undefined;
  }

  if (!("focalPoint" in presentation)) return undefined;

  let focalPoint = presentation.focalPoint;
  if (typeof focalPoint !== "object" || focalPoint === null) return undefined;
  if (!("x" in focalPoint) || !("y" in focalPoint)) return undefined;

  let x = Number(focalPoint.x);
  let y = Number(focalPoint.y);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  ) {
    return undefined;
  }

  return { x, y };
}

export function focalPointPosition(
  focalPoint: FocalPoint | undefined,
): string | undefined {
  if (!focalPoint) return undefined;
  return `${focalPoint.x * 100}% ${focalPoint.y * 100}%`;
}
