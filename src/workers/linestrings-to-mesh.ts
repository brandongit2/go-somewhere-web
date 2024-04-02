import {Float16Array} from "@petamoriken/float16"

import {FOUR_BYTES_PER_FLOAT32, FOUR_BYTES_PER_INT32, TWO_BYTES_PER_FLOAT16} from "@/const"
import Vec3Perf from "@/math/Vec3Perf"
import {type Coord3d, type WorldCoord} from "@/types"

export type LinestringsToMeshArgs = {
	linestringsBuffer: SharedArrayBuffer
	linestringsBufferSize: number
	numVertices: number
	viewPoint: WorldCoord
	thickness: number
}

export type LinestringsToMeshReturn = {
	buffer: ArrayBuffer
	indicesSize: number
	verticesSize: number
	uvsSize: number
}

export const linestringsToMesh = ({
	linestringsBuffer,
	linestringsBufferSize,
	numVertices,
	viewPoint,
	thickness,
}: LinestringsToMeshArgs) => {
	const indicesSize = numVertices * 15 * FOUR_BYTES_PER_INT32 // 15 = <max # triangles generated per corner, 5> * <3 vertices per triangle>
	const verticesSize = numVertices * 21 * FOUR_BYTES_PER_FLOAT32 // 21 = <max # vertices generated per corner, 7> * <3 coords per vertex>
	let uvsSize = numVertices * 14 * TWO_BYTES_PER_FLOAT16 // 14 = <max # vertices generated per corner, 7> * <2 coords per UV>
	if (uvsSize % 4 !== 0) uvsSize += 2 // Align to 4 bytes
	const buffer = new ArrayBuffer(indicesSize + verticesSize + uvsSize)

	const linestrings = new Float32Array(linestringsBuffer)
	const indices = new Uint32Array(buffer, 0, indicesSize / FOUR_BYTES_PER_INT32)
	const vertices = new Float32Array(buffer, indicesSize, verticesSize / FOUR_BYTES_PER_FLOAT32)
	const uvs = new Float16Array(buffer, indicesSize + verticesSize, uvsSize / TWO_BYTES_PER_FLOAT16)
	let ii = 0 // Index into `indices`
	let vi = 0 // Index into `vertices`, divided by 3
	let ui = 0 // Index into `uvs`
	for (let i = 0; i < linestringsBufferSize / FOUR_BYTES_PER_FLOAT32; ) {
		const lineLength = linestrings[i++]!
		const linestring = linestrings.subarray(i, i + lineLength * 3)
		;[ii, vi, ui] = linestringToMesh(indices, ii, vertices, vi, uvs, ui, linestring, viewPoint, thickness)

		i += lineLength * 3
	}

	const res: LinestringsToMeshReturn = {
		buffer,
		indicesSize,
		verticesSize,
		uvsSize,
	}
	postMessage(res, {transfer: [buffer]})
}

const linestringToMesh = (
	indices: Uint32Array,
	ii: number,
	vertices: Float32Array,
	vi: number,
	uvs: Float16Array,
	ui: number,
	linestring: Float32Array,
	viewPoint: WorldCoord,
	thickness: number,
) => {
	const halfThickness = thickness / 2

	let oldCurrentVertex: WorldCoord | undefined
	let oldNextVertex: WorldCoord | undefined
	let oldToNext: Coord3d | undefined
	for (let i = 0; i < linestring.length; i += 3) {
		const prevVertex =
			oldCurrentVertex ??
			(i > 2 ? ([linestring[i - 3], linestring[i - 2], linestring[i - 1]] as WorldCoord) : undefined)
		const currentVertex = oldNextVertex ?? ([linestring[i], linestring[i + 1], linestring[i + 2]] as WorldCoord)
		const nextVertex =
			i < linestring.length - 3 ? ([linestring[i + 3], linestring[i + 4], linestring[i + 5]] as WorldCoord) : undefined

		const faceDirection =
			viewPoint[0] === 0 && viewPoint[1] === 0 && viewPoint[2] === 0
				? Vec3Perf.normalize([0, 0, 0], currentVertex)
				: Vec3Perf.normalize([0, 0, 0], viewPoint)

		oldCurrentVertex = currentVertex
		oldNextVertex = nextVertex

		if (prevVertex && nextVertex) {
			let fromPrev: Coord3d
			if (oldToNext) {
				fromPrev = oldToNext
			} else {
				fromPrev = Vec3Perf.sub([0, 0, 0], currentVertex, prevVertex)
				Vec3Perf.normalize(fromPrev, fromPrev)
			}
			const toNext = Vec3Perf.sub([0, 0, 0], nextVertex, currentVertex)
			Vec3Perf.normalize(toNext, toNext)
			oldToNext = toNext

			const primaryPrevNormal = Vec3Perf.cross([0, 0, 0], fromPrev, faceDirection)
			const primaryNextNormal = Vec3Perf.cross([0, 0, 0], toNext, faceDirection)
			const primaryPrevNormalScaled = Vec3Perf.mulScalar([0, 0, 0], primaryPrevNormal, halfThickness)
			const primaryNextNormalScaled = Vec3Perf.mulScalar([0, 0, 0], primaryNextNormal, halfThickness)

			const isPrimarySideOut = Vec3Perf.dot(fromPrev, primaryNextNormal) > 0

			// Rect for previous segment
			indices.set([vi, vi + 1, vi - 1, vi, vi - 1, vi - 2], ii)
			ii += 6

			const primaryMiterDirection = Vec3Perf.add([0, 0, 0], primaryPrevNormal, primaryNextNormal)
			const m = Vec3Perf.lengthOf(primaryMiterDirection)
			if (m < 0.05) {
				// Mitre will be too long; just cap it off

				const extensionFromPrev = Vec3Perf.mulScalar([0, 0, 0], fromPrev, halfThickness)
				Vec3Perf.add(extensionFromPrev, extensionFromPrev, primaryPrevNormalScaled)
				const extensionFromNext = Vec3Perf.mulScalar([0, 0, 0], toNext, -halfThickness)
				Vec3Perf.add(extensionFromNext, extensionFromNext, primaryNextNormalScaled)

				// Rect for cap
				if (isPrimarySideOut) indices.set([vi, vi + 5, vi + 2, vi, vi + 4, vi + 5, vi, vi + 3, vi + 4], ii)
				else indices.set([vi + 2, vi + 6, vi + 1, vi + 1, vi + 6, vi + 3, vi + 1, vi + 3, vi + 4], ii)
				ii += 9

				vertices.set(
					[
						...Vec3Perf.add([0, 0, 0], currentVertex, primaryPrevNormalScaled),
						...Vec3Perf.sub([0, 0, 0], currentVertex, primaryPrevNormalScaled),
						...currentVertex,
						...Vec3Perf.add([0, 0, 0], currentVertex, extensionFromPrev),
						...Vec3Perf.add([0, 0, 0], currentVertex, extensionFromNext),
						...Vec3Perf.add([0, 0, 0], currentVertex, primaryNextNormalScaled),
						...Vec3Perf.sub([0, 0, 0], currentVertex, primaryNextNormalScaled),
					],
					vi * 3,
				)
				vi += 7

				// The basis vectors for UV space are u = `fromPrev` and v = `-primaryPrevNormal`.
				const uPrimaryPrevNormal = 0
				const vPrimaryPrevNormal = -1
				const uPrimaryNextNormal = Vec3Perf.dot(primaryNextNormal, fromPrev)
				const vPrimaryNextNormal = -Vec3Perf.dot(primaryNextNormal, primaryPrevNormal)
				uvs.set(
					[
						uPrimaryPrevNormal,
						vPrimaryPrevNormal,
						-uPrimaryPrevNormal,
						-vPrimaryPrevNormal,
						0,
						0,
						1,
						-1,
						Vec3Perf.dot(extensionFromNext, fromPrev) / halfThickness,
						-Vec3Perf.dot(extensionFromNext, primaryPrevNormal) / halfThickness,
						uPrimaryNextNormal,
						vPrimaryNextNormal,
						-uPrimaryNextNormal,
						-vPrimaryNextNormal,
					],
					ui,
				)
				ui += 14

				continue
			}
			Vec3Perf.mulScalar(primaryMiterDirection, primaryMiterDirection, 1 / m)

			const primaryMiterNormal = Vec3Perf.cross([0, 0, 0], primaryMiterDirection, faceDirection)

			let miterLength = 1 / Vec3Perf.dot(primaryPrevNormal, primaryMiterDirection)
			if (!isPrimarySideOut) miterLength *= -1
			const outerMiter = Vec3Perf.mulScalar([0, 0, 0], primaryMiterDirection, miterLength)
			const outerMiterScaled = Vec3Perf.mulScalar([0, 0, 0], outerMiter, halfThickness)

			// Rect for mitre
			if (isPrimarySideOut) indices.set([vi + 2, vi, vi + 3, vi + 2, vi + 3, vi + 4], ii)
			else indices.set([vi + 2, vi + 3, vi + 1, vi + 2, vi + 5, vi + 3], ii)
			ii += 6

			vertices.set(
				[
					...Vec3Perf.add([0, 0, 0], currentVertex, primaryPrevNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertex, primaryPrevNormalScaled),
					...currentVertex,
					...Vec3Perf.add([0, 0, 0], currentVertex, outerMiterScaled),
					...Vec3Perf.add([0, 0, 0], currentVertex, primaryNextNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertex, primaryNextNormalScaled),
				],
				vi * 3,
			)
			vi += 6

			// The basis vectors for UV space are u = `primaryMiterDirection` and v = `primaryMiterNormal`.
			const uPrimaryPrevNormal = Vec3Perf.dot(primaryPrevNormal, primaryMiterDirection)
			const vPrimaryPrevNormal = Vec3Perf.dot(primaryPrevNormal, primaryMiterNormal)
			const uPrimaryNextNormal = Vec3Perf.dot(primaryNextNormal, primaryMiterDirection)
			const vPrimaryNextNormal = Vec3Perf.dot(primaryNextNormal, primaryMiterNormal)
			uvs.set(
				[
					uPrimaryPrevNormal,
					vPrimaryPrevNormal,
					-uPrimaryPrevNormal,
					-vPrimaryPrevNormal,
					0,
					0,
					Vec3Perf.dot(outerMiter, primaryMiterDirection),
					Vec3Perf.dot(outerMiter, primaryMiterNormal),
					uPrimaryNextNormal,
					vPrimaryNextNormal,
					-uPrimaryNextNormal,
					-vPrimaryNextNormal,
				],
				ui,
			)
			ui += 12
		} else if (prevVertex) {
			let fromPrev: Coord3d
			if (oldToNext) {
				fromPrev = oldToNext
			} else {
				fromPrev = Vec3Perf.sub([0, 0, 0], currentVertex, prevVertex)
				Vec3Perf.normalize(fromPrev, fromPrev)
			}

			const primaryPrevNormal = Vec3Perf.cross([0, 0, 0], fromPrev, faceDirection)
			const primaryPrevNormalScaled = Vec3Perf.mulScalar([0, 0, 0], primaryPrevNormal, halfThickness)

			const extension = Vec3Perf.mulScalar([0, 0, 0], fromPrev, halfThickness)
			const currentVertexExtended = Vec3Perf.add([0, 0, 0], currentVertex, extension)

			// prettier-ignore
			indices.set([
				vi, vi - 1, vi - 2, vi, vi + 1, vi - 1, // Rect for previous segment
				vi, vi + 3, vi + 1, vi, vi + 2, vi + 3, // Rect for cap extension
			], ii)
			ii += 12
			vertices.set(
				[
					...Vec3Perf.add([0, 0, 0], currentVertex, primaryPrevNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertex, primaryPrevNormalScaled),
					...Vec3Perf.add([0, 0, 0], currentVertexExtended, primaryPrevNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertexExtended, primaryPrevNormalScaled),
				],
				vi * 3,
			)
			vi += 4
			uvs.set([1, 0, -1, 0, 1, 1, -1, 1], ui)
			ui += 8
		} else if (nextVertex) {
			const toNext = Vec3Perf.sub([0, 0, 0], nextVertex, currentVertex)
			Vec3Perf.normalize(toNext, toNext)

			const primaryNextNormal = Vec3Perf.cross([0, 0, 0], toNext, faceDirection)
			const primaryNextNormalScaled = Vec3Perf.mulScalar([0, 0, 0], primaryNextNormal, halfThickness)

			const extension = Vec3Perf.mulScalar([0, 0, 0], toNext, -halfThickness)
			const currentVertexExtended = Vec3Perf.add([0, 0, 0], currentVertex, extension)

			indices.set([vi, vi + 3, vi + 1, vi, vi + 2, vi + 3], ii)
			ii += 6
			vertices.set(
				[
					...Vec3Perf.add([0, 0, 0], currentVertexExtended, primaryNextNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertexExtended, primaryNextNormalScaled),
					...Vec3Perf.add([0, 0, 0], currentVertex, primaryNextNormalScaled),
					...Vec3Perf.sub([0, 0, 0], currentVertex, primaryNextNormalScaled),
				],
				vi * 3,
			)
			vi += 4
			uvs.set([1, -1, -1, -1, 1, 0, -1, 0], ui)
			ui += 8
		} else {
			const axis = [0, halfThickness, 0] as Coord3d
			const radius1 = Vec3Perf.cross([0, 0, 0], faceDirection, axis)
			const radius2 = Vec3Perf.cross([0, 0, 0], faceDirection, radius1)
			const extrusion1 = Vec3Perf.add([0, 0, 0], currentVertex, radius1)
			const extrusion2 = Vec3Perf.sub([0, 0, 0], currentVertex, radius1)

			indices.set([vi, vi + 3, vi + 2, vi, vi + 1, vi + 3], ii)
			ii += 6
			vertices.set(
				[
					...Vec3Perf.add([0, 0, 0], extrusion1, radius2),
					...Vec3Perf.add([0, 0, 0], extrusion2, radius2),
					...Vec3Perf.sub([0, 0, 0], extrusion1, radius2),
					...Vec3Perf.sub([0, 0, 0], extrusion2, radius2),
				],
				vi * 3,
			)
			vi += 4
			uvs.set([1, 1, -1, 1, 1, -1, -1, -1], ui)
			ui += 8
		}
	}

	return [ii, vi, ui] as const
}
