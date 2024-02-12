import earcut from "earcut"

import {commandTypes, decodeParameterInteger} from "./util"

export type Polygon = {
	vertices: number[]
	indices: number[]
}

export const parsePolygonGeometry = (geometry: number[], extent: number) => {
	let integerType: "command" | "parameter" = `command`
	let commandType: number | null = null
	let commandsLeft = 0
	let cursor: [number, number] = [0, 0]
	let polygons: Polygon[] = []
	let polygonDraft: number[][] = []
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

					if (polygonDraft.length === 0 || area < 0) polygonDraft.push(geometryDraft)
					else {
						let holeIndices = []
						let i = 0
						for (const geometry of polygonDraft.slice(0, -1)) {
							i += geometry.length / 2
							holeIndices.push(i)
						}

						polygons.push({
							vertices: polygonDraft.flat(),
							indices: earcut(polygonDraft.flat(), holeIndices),
						})

						polygonDraft = [geometryDraft]
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

	return polygons.map((polygon) => ({
		vertices: polygon.vertices.map((vertex, i) => (i % 2 === 0 ? vertex : 1 - vertex)),
		indices: polygon.indices,
	}))
}

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
