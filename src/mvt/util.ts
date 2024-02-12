export const commandTypes = {
	moveTo: 1,
	lineTo: 2,
	closePath: 7,
}

export const decodeParameterInteger = (integer: number) => (integer >> 1) ^ -(integer & 1)
