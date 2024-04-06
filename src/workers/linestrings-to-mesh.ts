import {FOUR_BYTES_PER_FLOAT32, FOUR_BYTES_PER_INT32} from "@/const"
import {Vec3} from "@/math/Vec3"
import {type WorldCoord} from "@/types"

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

// Pre-allocate a bunch of `Vec3`s to avoid creating and destroying them all the time
const vs = Array.from({length: 15}, () => new Vec3())
const v0 = vs[0]!,
	v1 = vs[1]!,
	v2 = vs[2]!,
	v3 = vs[3]!,
	v4 = vs[4]!,
	v5 = vs[5]!,
	v6 = vs[6]!,
	v7 = vs[7]!,
	v8 = vs[8]!,
	v9 = vs[9]!,
	v10 = vs[10]!,
	v11 = vs[11]!,
	v12 = vs[12]!,
	v13 = vs[13]!,
	v14 = vs[14]!

export const linestringsToMesh = ({
	linestringsBuffer,
	linestringsBufferSize,
	numVertices,
	viewPoint,
	thickness,
}: LinestringsToMeshArgs) => {
	const indicesSize = numVertices * 15 * FOUR_BYTES_PER_INT32 // 15 = <max # triangles generated per corner, 5> * <3 vertices per triangle>
	const verticesSize = numVertices * 21 * FOUR_BYTES_PER_FLOAT32 // 21 = <max # vertices generated per corner, 7> * <3 coords per vertex>
	let uvsSize = numVertices * 14 * FOUR_BYTES_PER_FLOAT32 // 14 = <max # vertices generated per corner, 7> * <2 coords per UV>
	if (uvsSize % 4 !== 0) uvsSize += 2 // Align to 4 bytes
	const buffer = new ArrayBuffer(indicesSize + verticesSize + uvsSize)

	const linestrings = new Float32Array(linestringsBuffer)
	const indices = new Uint32Array(buffer, 0, indicesSize / FOUR_BYTES_PER_INT32)
	const vertices = new Float32Array(buffer, indicesSize, verticesSize / FOUR_BYTES_PER_FLOAT32)
	const uvs = new Float32Array(buffer, indicesSize + verticesSize, uvsSize / FOUR_BYTES_PER_FLOAT32)
	const is: [number, number, number] = [0, 0, 0] // Indices offset (`ii`), vertices offset (`vi`), UVs offset (`ui`)
	for (let i = 0; i < linestringsBufferSize / FOUR_BYTES_PER_FLOAT32; ) {
		const lineLength = linestrings[i++]!
		const linestring = linestrings.subarray(i, i + lineLength * 3)
		linestringToMesh(indices, vertices, uvs, is, linestring, new Vec3(viewPoint), thickness)

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
	vertices: Float32Array,
	uvs: Float32Array,
	is: [number, number, number],
	linestring: Float32Array,
	viewPoint: Vec3,
	thickness: number,
) => {
	const halfThickness = thickness / 2

	let oldCurrentVertex: Vec3 | undefined
	let oldNextVertex: Vec3 | undefined
	let oldToNext: Vec3 | undefined
	for (let i = 0; i < linestring.length; i += 3) {
		const prevVertex =
			oldCurrentVertex ?? (i > 2 ? v0.set(linestring[i - 3]!, linestring[i - 2]!, linestring[i - 1]!) : undefined)
		const currentVertex = oldNextVertex ?? v1.set(linestring[i]!, linestring[i + 1]!, linestring[i + 2]!)
		const nextVertex =
			i < linestring.length - 3 ? v2.set(linestring[i + 3]!, linestring[i + 4]!, linestring[i + 5]!) : undefined

		const faceDirection = viewPoint.equals(v3.set(0, 0, 0))
			? Vec3.normalize(v3, currentVertex)
			: Vec3.normalize(v3, viewPoint)

		if (prevVertex && nextVertex) {
			const fromPrev = oldToNext ?? Vec3.normalize(v4, Vec3.subtract(v4, currentVertex, prevVertex))
			const toNext = Vec3.subtract(v5, nextVertex, currentVertex).normalize()
			oldToNext = toNext

			const primaryPrevNormal = Vec3.cross(v6, fromPrev, faceDirection)
			const primaryNextNormal = Vec3.cross(v7, toNext, faceDirection)
			const primaryPrevNormalScaled = Vec3.scaleBy(v8, primaryPrevNormal, halfThickness)
			const primaryNextNormalScaled = Vec3.scaleBy(v9, primaryNextNormal, halfThickness)

			const isPrimarySideOut = Vec3.dot(fromPrev, primaryNextNormal) > 0

			// Rect for previous segment
			let vi = is[1]
			indices.set([vi, vi + 1, vi - 1, vi, vi - 1, vi - 2], is[0])
			is[0] += 6

			const primaryMiterDirection = Vec3.add(v10, primaryPrevNormal, primaryNextNormal)
			const m = Vec3.lengthOf(primaryMiterDirection)
			if (m < 0.05) {
				// Mitre will be too long; just cap it off

				const extensionFromPrev = Vec3.scaleBy(v11, fromPrev, halfThickness).add(primaryPrevNormalScaled)
				const extensionFromNext = Vec3.scaleBy(v12, toNext, -halfThickness).add(primaryNextNormalScaled)

				// Rect for cap
				vi = is[1]
				if (isPrimarySideOut) indices.set([vi, vi + 5, vi + 2, vi, vi + 4, vi + 5, vi, vi + 3, vi + 4], is[0])
				else indices.set([vi + 2, vi + 6, vi + 1, vi + 1, vi + 6, vi + 3, vi + 1, vi + 3, vi + 4], is[0])
				is[0] += 9

				vertices.set(
					[
						...Vec3.add(v13, currentVertex, primaryPrevNormalScaled),
						...Vec3.subtract(v13, currentVertex, primaryPrevNormalScaled),
						...currentVertex,
						...Vec3.add(v13, currentVertex, extensionFromPrev),
						...Vec3.add(v13, currentVertex, extensionFromNext),
						...Vec3.add(v13, currentVertex, primaryNextNormalScaled),
						...Vec3.subtract(v13, currentVertex, primaryNextNormalScaled),
					],
					is[1] * 3,
				)
				is[1] += 7

				// The basis vectors for UV space are u = `fromPrev` and v = `-primaryPrevNormal`.
				const uPrimaryPrevNormal = 0
				const vPrimaryPrevNormal = -1
				const uPrimaryNextNormal = Vec3.dot(primaryNextNormal, fromPrev)
				const vPrimaryNextNormal = -Vec3.dot(primaryNextNormal, primaryPrevNormal)
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
						Vec3.dot(extensionFromNext, fromPrev) / halfThickness,
						-Vec3.dot(extensionFromNext, primaryPrevNormal) / halfThickness,
						uPrimaryNextNormal,
						vPrimaryNextNormal,
						-uPrimaryNextNormal,
						-vPrimaryNextNormal,
					],
					is[2],
				)
				is[2] += 14

				continue
			}
			Vec3.scaleBy(primaryMiterDirection, primaryMiterDirection, 1 / m)

			const primaryMiterNormal = Vec3.cross(v11, primaryMiterDirection, faceDirection)

			let miterLength = 1 / Vec3.dot(primaryPrevNormal, primaryMiterDirection)
			if (!isPrimarySideOut) miterLength *= -1
			const outerMiter = Vec3.scaleBy(v12, primaryMiterDirection, miterLength)
			const outerMiterScaled = Vec3.scaleBy(v13, outerMiter, halfThickness)

			// Rect for mitre
			vi = is[1]
			if (isPrimarySideOut) indices.set([vi + 2, vi, vi + 3, vi + 2, vi + 3, vi + 4], is[0])
			else indices.set([vi + 2, vi + 3, vi + 1, vi + 2, vi + 5, vi + 3], is[0])
			is[0] += 6

			vertices.set(
				[
					...Vec3.add(v14, currentVertex, primaryPrevNormalScaled),
					...Vec3.subtract(v14, currentVertex, primaryPrevNormalScaled),
					...currentVertex,
					...Vec3.add(v14, currentVertex, outerMiterScaled),
					...Vec3.add(v14, currentVertex, primaryNextNormalScaled),
					...Vec3.subtract(v14, currentVertex, primaryNextNormalScaled),
				],
				is[1] * 3,
			)
			is[1] += 6

			// The basis vectors for UV space are u = `primaryMiterDirection` and v = `primaryMiterNormal`.
			const uPrimaryPrevNormal = Vec3.dot(primaryPrevNormal, primaryMiterDirection)
			const vPrimaryPrevNormal = Vec3.dot(primaryPrevNormal, primaryMiterNormal)
			const uPrimaryNextNormal = Vec3.dot(primaryNextNormal, primaryMiterDirection)
			const vPrimaryNextNormal = Vec3.dot(primaryNextNormal, primaryMiterNormal)
			uvs.set(
				[
					uPrimaryPrevNormal,
					vPrimaryPrevNormal,
					-uPrimaryPrevNormal,
					-vPrimaryPrevNormal,
					0,
					0,
					Vec3.dot(outerMiter, primaryMiterDirection),
					Vec3.dot(outerMiter, primaryMiterNormal),
					uPrimaryNextNormal,
					vPrimaryNextNormal,
					-uPrimaryNextNormal,
					-vPrimaryNextNormal,
				],
				is[2],
			)
			is[2] += 12
		} else if (prevVertex) {
			const fromPrev = oldToNext ?? Vec3.subtract(v4, currentVertex, prevVertex).normalize()

			const primaryPrevNormal = Vec3.cross(v5, fromPrev, faceDirection)
			const primaryPrevNormalScaled = Vec3.scaleBy(v5, primaryPrevNormal, halfThickness)

			const extension = Vec3.scaleBy(v6, fromPrev, halfThickness)
			const currentVertexExtended = Vec3.add(v6, currentVertex, extension)

			const vi = is[1]
			// prettier-ignore
			indices.set([
				vi, vi - 1, vi - 2, vi, vi + 1, vi - 1, // Rect for previous segment
				vi, vi + 3, vi + 1, vi, vi + 2, vi + 3, // Rect for cap extension
			], is[0])
			is[0] += 12
			vertices.set(
				[
					...Vec3.add(v7, currentVertex, primaryPrevNormalScaled),
					...Vec3.subtract(v7, currentVertex, primaryPrevNormalScaled),
					...Vec3.add(v7, currentVertexExtended, primaryPrevNormalScaled),
					...Vec3.subtract(v7, currentVertexExtended, primaryPrevNormalScaled),
				],
				vi * 3,
			)
			is[1] += 4
			uvs.set([1, 0, -1, 0, 1, 1, -1, 1], is[2])
			is[2] += 8
		} else if (nextVertex) {
			const toNext = Vec3.subtract(v4, nextVertex, currentVertex).normalize()

			const primaryNextNormal = Vec3.cross(v5, toNext, faceDirection)
			const primaryNextNormalScaled = Vec3.scaleBy(v5, primaryNextNormal, halfThickness)

			const extension = Vec3.scaleBy(v6, toNext, -halfThickness)
			const currentVertexExtended = Vec3.add(v6, currentVertex, extension)

			const vi = is[1]
			indices.set([vi, vi + 3, vi + 1, vi, vi + 2, vi + 3], is[0])
			is[0] += 6
			vertices.set(
				[
					...Vec3.add(v7, currentVertexExtended, primaryNextNormalScaled),
					...Vec3.subtract(v7, currentVertexExtended, primaryNextNormalScaled),
					...Vec3.add(v7, currentVertex, primaryNextNormalScaled),
					...Vec3.subtract(v7, currentVertex, primaryNextNormalScaled),
				],
				vi * 3,
			)
			is[1] += 4
			uvs.set([1, -1, -1, -1, 1, 0, -1, 0], is[2])
			is[2] += 8
		} else {
			const axis = v4.set(0, halfThickness, 0)
			const radius1 = Vec3.cross(v5, faceDirection, axis)
			const radius2 = Vec3.cross(v6, faceDirection, radius1)
			const extrusion1 = Vec3.add(v7, currentVertex, radius1)
			const extrusion2 = Vec3.subtract(v8, currentVertex, radius1)

			const vi = is[1]
			indices.set([vi, vi + 3, vi + 2, vi, vi + 1, vi + 3], is[0])
			is[0] += 6
			vertices.set(
				[
					...Vec3.add(v9, extrusion1, radius2),
					...Vec3.add(v9, extrusion2, radius2),
					...Vec3.subtract(v9, extrusion1, radius2),
					...Vec3.subtract(v9, extrusion2, radius2),
				],
				vi * 3,
			)
			is[1] += 4
			uvs.set([1, 1, -1, 1, 1, -1, -1, -1], is[2])
			is[2] += 8
		}

		oldCurrentVertex = v0.set(currentVertex)
		if (nextVertex) oldNextVertex = v1.set(nextVertex)
	}
}
