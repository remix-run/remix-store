export interface FocalPoint {
  x: number;
  y: number;
}

type PresentationJson =
  | boolean
  | number
  | string
  | null
  | PresentationJson[]
  | PresentationJsonObject;

interface PresentationJsonObject {
  [key: string]: PresentationJson;
}

/** Extracts normalized focal-point coordinates from Shopify image presentation data. */
export function getFocalPoint(
  presentation: PresentationJson | undefined,
): FocalPoint | undefined {
  if (!isPresentationObject(presentation)) return undefined;

  let focalPoint = presentation.focalPoint;
  if (!isPresentationObject(focalPoint)) return undefined;

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

function isPresentationObject(
  value: PresentationJson | undefined,
): value is PresentationJsonObject {
  return value !== null && !Array.isArray(value) && Object(value) === value;
}
