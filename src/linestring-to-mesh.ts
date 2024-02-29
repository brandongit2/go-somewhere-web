import {Vec3} from "@/math/Vec3"
import {type Coord3d, type MercatorCoord, type WorldCoord} from "@/types"
import {mercatorToEcef, roughEq} from "@/util"

export const linestringToMesh = (linestring: MercatorCoord[]) => {
	const linestring3d = linestring
		.map((vertex) => new Vec3(mercatorToEcef(vertex)))
		.map((vertex) => new Vec3([vertex.y, vertex.z, vertex.x]))

	const vertices: WorldCoord[] = []
	const normals: Coord3d[] = []
	const miterLengths: number[] = []
	let indices: number[] = []
	if (linestring3d.length < 2) return {vertices, normals, miterLengths, indices}

	let oldNextNormal: Vec3 | undefined
	for (let i = 0; i < linestring3d.length; i++) {
		// The current vertex has a vector pointing to the previous vertex and/or a vector pointing to the next vertex. For
		// these vectors, we find a vector perpendicular to them, tangent to the globe. The mitre is then the bisector of
		// these two vectors, scaled by the mitre length.

		const currentVertex = linestring3d[i]!
		const nextVertex = linestring3d[i + 1]
		const sphereNormal = currentVertex

		let toNext = nextVertex && Vec3.sub(nextVertex, currentVertex)

		let nextNormal: Vec3
		if (toNext) nextNormal = Vec3.cross(toNext, sphereNormal)
		// If there is no next vertex, pretend there was one in the same direction as `toNext` from the previous vertex
		else nextNormal = oldNextNormal!

		let prevNormal: Vec3
		if (oldNextNormal) prevNormal = oldNextNormal
		// If there is no previous vertex, pretend there was one in the opposite direction as `toNext`
		else prevNormal = nextNormal

		const angle = Vec3.angleBetween(prevNormal, nextNormal)
		let miterLength = 1
		if (!roughEq(angle, Math.PI)) miterLength = 1 / Math.cos(angle / 2)
		const miter = Vec3.bisect(prevNormal, nextNormal, miterLength)

		oldNextNormal = nextNormal

		vertices.push(currentVertex.as<WorldCoord>(), currentVertex.as<WorldCoord>())
		normals.push(miter.normalized().toTuple(), miter.times(-1).normalized().toTuple())
		miterLengths.push(miterLength, miterLength)
	}

	for (let i = 0; i < vertices.length - 2; i += 2) {
		indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
	}

	return {vertices, normals, miterLengths, indices}
}
