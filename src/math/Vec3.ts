import {Quaternion} from "@/math/Quaternion"
import Vec3Perf from "@/math/Vec3Perf"
import {type Coord3d} from "@/types"
import {clamp} from "@/util"

export class Vec3 {
	x: number
	y: number
	z: number

	constructor(x: number, y: number, z: number)
	constructor(xyz: [number, number, number])
	constructor(xOrXyz: number | [number, number, number], y?: number, z?: number) {
		if (typeof xOrXyz === `number`) {
			this.x = xOrXyz
			this.y = y!
			this.z = z!
		} else {
			this.x = xOrXyz[0]
			this.y = xOrXyz[1]
			this.z = xOrXyz[2]
		}
	}

	as = <T extends [number, number, number]>() => [this.x, this.y, this.z] as T
	toString = () => `(${this.x.toFixed(5)}, ${this.y.toFixed(5)}, ${this.z.toFixed(5)})`
	toTuple = () => [this.x, this.y, this.z] as [number, number, number]

	set = (x: number, y: number, z: number) => {
		this.x = x
		this.y = y
		this.z = z
		return this
	}

	static add = (a: Vec3, b: Vec3) => {
		let v: Coord3d = [0, 0, 0]
		Vec3Perf.add(v, a.toTuple(), b.toTuple())
		return new Vec3(v)
	}
	plus = (v: Vec3) => Vec3.add(this, v)

	static sub = (a: Vec3, b: Vec3) => {
		let v: Coord3d = [0, 0, 0]
		Vec3Perf.sub(v, a.toTuple(), b.toTuple())
		return new Vec3(v)
	}
	minus = (v: Vec3) => Vec3.sub(this, v)

	static dot = (a: Vec3, b: Vec3) => Vec3Perf.dot(a.toTuple(), b.toTuple())
	dot = (v: Vec3) => Vec3.dot(this, v)

	static cross = (a: Vec3, b: Vec3) => {
		let v: Coord3d = [0, 0, 0]
		Vec3Perf.cross(v, a.toTuple(), b.toTuple())
		return new Vec3(v)
	}
	cross = (v: Vec3) => Vec3.cross(this, v)

	static angleBetween = (a: Vec3, b: Vec3) => {
		const cosAngle = Vec3.dot(a, b) / (a.length() * b.length())
		// Due to floating point errors, `cosAngle` can sometimes be slightly outside the range [-1, 1]. Clamp to valid range.
		return Math.acos(clamp(cosAngle, -1, 1))
	}

	distanceTo = (v: Vec3) => this.minus(v).length()

	static lengthOf = (v: Vec3) => Vec3Perf.lengthOf(v.toTuple())
	length = () => Vec3.lengthOf(this)

	static normalize = (v: Vec3) => {
		let vt: Coord3d = [0, 0, 0]
		Vec3Perf.normalize(vt, v.toTuple())
		return new Vec3(vt)
	}
	normalized = () => Vec3.normalize(this)

	// Adapted from three.js' `Vector3.prototype.applyQuaternion()` method
	static rotateAbout = (v: Vec3, axis: Vec3, angle: number) => {
		const q = Quaternion.fromAxisAngle(axis, angle)

		const tx = 2 * (q.y * v.z - q.z * v.y)
		const ty = 2 * (q.z * v.x - q.x * v.z)
		const tz = 2 * (q.x * v.y - q.y * v.x)

		return new Vec3(
			v.x + q.w * tx + q.y * tz - q.z * ty,
			v.y + q.w * ty + q.z * tx - q.x * tz,
			v.z + q.w * tz + q.x * ty - q.y * tx,
		)
	}

	static scale = (v: Vec3, s: number) => {
		let vt: Coord3d = [0, 0, 0]
		Vec3Perf.mulScalar(vt, v.toTuple(), s)
		return new Vec3(vt)
	}
	scaledBy = (s: number) => Vec3.scale(this, s)
}
