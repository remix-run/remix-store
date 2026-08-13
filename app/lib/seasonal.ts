export type Clock = () => Date;

/** Returns whether a server instant falls within December in UTC. */
export function isUtcDecember(date: Date): boolean {
  return date.getUTCMonth() === 11;
}
