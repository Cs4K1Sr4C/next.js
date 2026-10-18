/** Reads an integer of at least `min` from the environment, failing fast on anything else. */
export function integerFromEnv(
  name: string,
  fallback: number,
  min: number,
): number {
  return numberFromEnv(
    name,
    fallback,
    (value) => Number.isSafeInteger(value) && value >= min,
    `an integer >= ${min}`,
  );
}

/** Reads a number from 0 to 1 (a probability) from the environment. */
export function fractionFromEnv(name: string, fallback: number): number {
  return numberFromEnv(
    name,
    fallback,
    (value) => value >= 0 && value <= 1,
    "a number from 0 to 1",
  );
}

function numberFromEnv(
  name: string,
  fallback: number,
  isValid: (value: number) => boolean,
  expected: string,
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!isValid(value)) {
    throw new Error(`${name} must be ${expected}, got "${raw}"`);
  }
  return value;
}
