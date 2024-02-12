import earcut from "earcut"

export type Shape = {
	vertices: number[]
	indices: number[]
}

export const parsePolygonGeometry = (geometry: number[], extent: number) => {
	let integerType: "command" | "parameter" = `command`
	let commandType: number | null = null
	let commandsLeft = 0
	let cursor: [number, number] = [0, 0]
	let shapes: Shape[] = []
	let shapeDraft: number[][] = []
	let geometryDraft: number[] = []
	for (let i = 0; i < geometry.length; i++) {
		const integer = geometry[i]

		switch (integerType) {
			case `command`: {
				commandType = integer & 0x7
				const commandCount = integer >> 3
				commandsLeft = commandCount

				if (commandType === commandTypes.closePath) {
					const area = calculatePolygonArea(geometryDraft)

					if (shapeDraft.length === 0 || area < 0) shapeDraft.push(geometryDraft)
					else {
						let holeIndices = []
						let i = 0
						for (const geometry of shapeDraft.slice(0, -1)) {
							i += geometry.length / 2
							holeIndices.push(i)
						}

						shapes.push({
							vertices: shapeDraft.flat(),
							indices: earcut(shapeDraft.flat(), holeIndices),
						})

						shapeDraft = [geometryDraft]
					}

					geometryDraft = []
				} else integerType = `parameter`

				break
			}
			case `parameter`: {
				const x = cursor[0] + decodeParameterInteger(integer)
				const y = cursor[1] + decodeParameterInteger(geometry[i + 1])
				geometryDraft.push(x / extent, y / extent)
				cursor = [x, y]
				i++

				commandsLeft--
			}
		}

		if (commandsLeft === 0) integerType = `command`
	}

	return shapes.map((shape) => ({
		vertices: shape.vertices.map((vertex, i) => (i % 2 === 0 ? vertex : 1 - vertex)),
		indices: shape.indices,
	}))
}

const commandTypes = {
	moveTo: 1,
	lineTo: 2,
	closePath: 7,
}

const decodeParameterInteger = (integer: number) => (integer >> 1) ^ -(integer & 1)

const calculatePolygonArea = (vertices: number[]) => {
	let area = 0
	const n = vertices.length / 2

	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n // Next vertex index, wrapping around to 0 at the end

		const xi = vertices[i * 2]
		const yi = vertices[i * 2 + 1]
		const xj = vertices[j * 2]
		const yj = vertices[j * 2 + 1]

		area += xi * yj - xj * yi
	}

	return area / 2
}
