import {type Coord3d} from "@/types"
import {clamp} from "@/util"

const add = (v: Coord3d, a: Coord3d, b: Coord3d) => {
	v[0] = a[0] + b[0]
	v[1] = a[1] + b[1]
	v[2] = a[2] + b[2]
	return v
}

const sub = (v: Coord3d, a: Coord3d, b: Coord3d) => {
	v[0] = a[0] - b[0]
	v[1] = a[1] - b[1]
	v[2] = a[2] - b[2]
	return v
}

const dot = (a: Coord3d, b: Coord3d) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const cross = (v: Coord3d, a: Coord3d, b: Coord3d) => {
	v[0] = a[1] * b[2] - a[2] * b[1]
	v[1] = a[2] * b[0] - a[0] * b[2]
	v[2] = a[0] * b[1] - a[1] * b[0]
	return v
}

const angleBetween = (a: Coord3d, b: Coord3d) => {
	const cosAngle = dot(a, b) / (lengthOf(a) * lengthOf(b))
	// Due to floating point errors, `cosAngle` can sometimes be slightly outside the range [-1, 1]. Clamp to valid range.
	return Math.acos(clamp(cosAngle, -1, 1))
}

const lengthOf = (v: Coord3d) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])

const mulScalar = (v: Coord3d, a: Coord3d, s: number) => {
	v[0] = a[0] * s
	v[1] = a[1] * s
	v[2] = a[2] * s
	return v
}

const normalize = (v: Coord3d, a: Coord3d) => {
	const length = Vec3Perf.lengthOf(a)
	v[0] = a[0] / length
	v[1] = a[1] / length
	v[2] = a[2] / length
	return v
}

const Vec3Perf = {
	add,
	sub,
	dot,
	cross,
	angleBetween,
	lengthOf,
	mulScalar,
	normalize,
}

export default Vec3Perf
