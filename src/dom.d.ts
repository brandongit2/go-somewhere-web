/* eslint-disable @typescript-eslint/prefer-function-type */
/* eslint-disable @typescript-eslint/consistent-type-definitions */

interface SharedArrayBuffer {
	grow(newLength: number): void
	readonly growable: boolean
	readonly maxByteLength: number
}

interface SharedArrayBufferConstructor {
	new (length: number, options?: {maxByteLength?: number}): SharedArrayBuffer
}
