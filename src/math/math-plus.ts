export const roughEq = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) < epsilon

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
