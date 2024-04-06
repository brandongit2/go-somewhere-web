import {type Mat4} from "@/math/Mat4"
import {type Quaternion} from "@/math/Quaternion"
import {clamp, roughEq} from "@/util"

export class Vec3 {
	x = 0
	y = 0
	z = 0

	constructor()
	constructor(x: number, y: number, z: number)
	constructor(v: Vec3)
	constructor(xyz: [number, number, number])
	constructor(xOrOthers?: number | [number, number, number] | Vec3, y?: number, z?: number) {
		if (xOrOthers === undefined) {
			this.set()
		} else if (typeof xOrOthers === `number`) {
			this.set(xOrOthers, y!, z!)
		} else if (Array.isArray(xOrOthers)) {
			this.set(xOrOthers)
		} else {
			this.set(xOrOthers)
		}
	}

	as = <T extends [number, number, number]>() => [this.x, this.y, this.z] as T
	static clone = (v: Vec3) => new Vec3(v.x, v.y, v.z)
	toString = () => `(${this.x.toFixed(5)}, ${this.y.toFixed(5)}, ${this.z.toFixed(5)})`
	toTuple = () => [this.x, this.y, this.z] as [number, number, number];
	*[Symbol.iterator]() {
		yield this.x
		yield this.y
		yield this.z
	}

	static areEqual = (a: Vec3, b: Vec3) => roughEq(a.x, b.x) && roughEq(a.y, b.y) && roughEq(a.z, b.z)
	equals = (v: Vec3) => Vec3.areEqual(this, v)

	set: {
		(): Vec3
		(x: number, y: number, z: number): Vec3
		(a: Vec3): Vec3
		(xyz: [number, number, number]): Vec3
	} = (xOrOthers?: number | Vec3 | [number, number, number], y?: number, z?: number) => {
		if (xOrOthers === undefined) {
			this.x = 0
			this.y = 0
			this.z = 0
		} else if (typeof xOrOthers === `number`) {
			this.x = xOrOthers
			this.y = y!
			this.z = z!
		} else if (Array.isArray(xOrOthers)) {
			this.x = xOrOthers[0]
			this.y = xOrOthers[1]
			this.z = xOrOthers[2]
		} else {
			this.x = xOrOthers.x
			this.y = xOrOthers.y
			this.z = xOrOthers.z
		}
		return this
	}

	static add = (v: Vec3 | null, a: Vec3, b: Vec3) => {
		const x = a.x + b.x
		const y = a.y + b.y
		const z = a.z + b.z
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	add = (v: Vec3) => Vec3.add(this, this, v)

	static subtract = (v: Vec3 | null, a: Vec3, b: Vec3) => {
		const x = a.x - b.x
		const y = a.y - b.y
		const z = a.z - b.z
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	subtract = (v: Vec3) => Vec3.subtract(this, this, v)

	static dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
	dot = (v: Vec3) => Vec3.dot(this, v)

	static cross = (v: Vec3 | null, a: Vec3, b: Vec3) => {
		const x = a.y * b.z - a.z * b.y
		const y = a.z * b.x - a.x * b.z
		const z = a.x * b.y - a.y * b.x
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	cross = (a: Vec3) => Vec3.cross(this, this, a)

	static angleBetween = (a: Vec3, b: Vec3) => {
		const cosAngle = Vec3.dot(a, b) / (a.length() * b.length())
		// Due to floating point errors, `cosAngle` can sometimes be slightly outside the range [-1, 1]. Clamp to valid range.
		return Math.acos(clamp(cosAngle, -1, 1))
	}

	static applyMat4 = (v: Vec3 | null, m: Mat4, a: Vec3) => {
		const w = m._41 * a.x + m._42 * a.y + m._43 * a.z + m._44
		const x = (m._11 * a.x + m._12 * a.y + m._13 * a.z + m._14) / w
		const y = (m._21 * a.x + m._22 * a.y + m._23 * a.z + m._24) / w
		const z = (m._31 * a.x + m._32 * a.y + m._33 * a.z + m._34) / w
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	applyMat4 = (m: Mat4) => Vec3.applyMat4(null, m, this)

	static applyQuaternion = (v: Vec3 | null, a: Vec3, q: Quaternion) => {
		// t = 2 * cross(q.xyz, v)
		const tx = 2 * (q.y * a.z - q.z * a.y)
		const ty = 2 * (q.z * a.x - q.x * a.z)
		const tz = 2 * (q.x * a.y - q.y * a.x)

		// a + q.w * t + cross(q.xyz, t)
		const x = a.x + q.w * tx + q.y * tz - q.z * ty
		const y = a.y + q.w * ty + q.z * tx - q.x * tz
		const z = a.z + q.w * tz + q.x * ty - q.y * tx

		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	applyQuaternion = (q: Quaternion) => Vec3.applyQuaternion(this, this, q)

	static distanceBetween = (a: Vec3, b: Vec3) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
	distanceTo = (a: Vec3) => Vec3.distanceBetween(this, a)

	static lengthOf = (a: Vec3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
	length = () => Vec3.lengthOf(this)

	static normalize = (v: Vec3 | null, a: Vec3) => {
		const length = Vec3.lengthOf(a)
		const x = a.x / length
		const y = a.y / length
		const z = a.z / length
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	normalize = () => Vec3.normalize(this, this)

	static scaleBy = (v: Vec3 | null, a: Vec3, s: number) => {
		const x = a.x * s
		const y = a.y * s
		const z = a.z * s
		return v ? v.set(x, y, z) : new Vec3(x, y, z)
	}
	scaleBy = (s: number) => Vec3.scaleBy(this, this, s)
}
