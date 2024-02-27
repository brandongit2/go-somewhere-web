import {Vec2} from "@/math/Vec2"
import {roughEq} from "@/util"

export const linestringToMesh = (linestring: number[]) => {
	const vertices: number[] = []
	const normals: number[] = []
	const miterLengths: number[] = []
	let indices: number[] = []
	if (linestring.length < 4) return {vertices, normals, miterLengths, indices}

	let prev_nextNormal: Vec2 | undefined
	for (let i = 0; i < linestring.length; i += 2) {
		const currentVertex = new Vec2(linestring[i]!, linestring[i + 1]!)
		const nextVertex = i === linestring.length - 2 ? undefined : new Vec2(linestring[i + 2]!, linestring[i + 3]!)

		let toNext = nextVertex && Vec2.sub(nextVertex, currentVertex).normalized()
		let nextNormal = toNext ? new Vec2(-toNext.y, toNext.x) : prev_nextNormal!
		let prevNormal = prev_nextNormal ?? nextNormal

		const angle = Vec2.angleBetween(prevNormal, nextNormal)
		let miterLength = 1
		if (!roughEq(angle, Math.PI)) miterLength = 1 / Math.cos(angle / 2)
		const miter = Vec2.bisect(prevNormal, nextNormal, miterLength)

		prev_nextNormal = nextNormal

		vertices.push(...currentVertex, ...currentVertex)
		normals.push(...miter.normalized(), ...miter.times(-1).normalized())
		miterLengths.push(miterLength, miterLength)
	}

	for (let i = 0; i < linestring.length - 2; i += 2) {
		indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
	}

	return {vertices, normals, miterLengths, indices}
}
