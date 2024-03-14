export type Feature = {
	draw: (passEncoder: GPURenderPassEncoder) => void
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	set: (args: any) => void
}
