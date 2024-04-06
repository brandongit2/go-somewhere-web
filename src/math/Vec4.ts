import {type Mat4} from "@/math/Mat4"
import {roughEq} from "@/util"

export class Vec4 {
	x = 0
	y = 0
	z = 0
	w = 0

	constructor()
	constructor(x: number, y: number, z: number, w: number)
	constructor(v: Vec4)
	constructor(xyzw: [number, number, number, number])
	constructor(xOrOthers?: number | [number, number, number, number] | Vec4, y?: number, z?: number, w?: number) {
		if (xOrOthers === undefined) {
			this.set()
		} else if (typeof xOrOthers === `number`) {
			this.set(xOrOthers, y!, z!, w!)
		} else if (Array.isArray(xOrOthers)) {
			this.set(xOrOthers)
		} else {
			this.set(xOrOthers)
		}
	}

	as = <T extends [number, number, number, number]>() => [this.x, this.y, this.z, this.w] as T
	static clone = (v: Vec4) => new Vec4(v.x, v.y, v.z, v.w)
	toString = () => `(${this.x.toFixed(5)}, ${this.y.toFixed(5)}, ${this.z.toFixed(5)}, ${this.w.toFixed(5)})`
	toTuple = () => [this.x, this.y, this.z, this.w] as [number, number, number, number];
	*[Symbol.iterator]() {
		yield this.x
		yield this.y
		yield this.z
		yield this.w
	}

	static areEqual = (a: Vec4, b: Vec4) =>
		roughEq(a.x, b.x) && roughEq(a.y, b.y) && roughEq(a.z, b.z) && roughEq(a.w, b.w)
	equals = (v: Vec4) => Vec4.areEqual(this, v)

	set: {
		(): Vec4
		(x: number, y: number, z: number, w: number): Vec4
		(a: Vec4): Vec4
		(xyzw: [number, number, number, number]): Vec4
	} = (xOrOthers?: number | Vec4 | [number, number, number, number], y?: number, z?: number, w?: number) => {
		if (xOrOthers === undefined) {
			this.x = 0
			this.y = 0
			this.z = 0
			this.w = 0
		} else if (typeof xOrOthers === `number`) {
			this.x = xOrOthers
			this.y = y!
			this.z = z!
			this.w = w!
		} else if (Array.isArray(xOrOthers)) {
			this.x = xOrOthers[0]
			this.y = xOrOthers[1]
			this.z = xOrOthers[2]
			this.w = xOrOthers[3]
		} else {
			this.x = xOrOthers.x
			this.y = xOrOthers.y
			this.z = xOrOthers.z
			this.w = xOrOthers.w
		}
		return this
	}

	static add = (v: Vec4 | null, a: Vec4, b: Vec4) => {
		v = v ?? new Vec4()
		v.x = a.x + b.x
		v.y = a.y + b.y
		v.z = a.z + b.z
		v.w = a.w + b.w
		return v
	}
	add = (v: Vec4) => Vec4.add(this, this, v)

	static subtract = (v: Vec4 | null, a: Vec4, b: Vec4) => {
		v = v ?? new Vec4()
		v.x = a.x - b.x
		v.y = a.y - b.y
		v.z = a.z - b.z
		v.w = a.w - b.w
		return v
	}
	subtract = (v: Vec4) => Vec4.subtract(this, this, v)

	static applyMat4 = (v: Vec4 | null, m: Mat4, a: Vec4) => {
		const x = a.x * m._11 + a.y * m._12 + a.z * m._13 + a.w * m._14
		const y = a.x * m._21 + a.y * m._22 + a.z * m._23 + a.w * m._24
		const z = a.x * m._31 + a.y * m._32 + a.z * m._33 + a.w * m._34
		const w = a.x * m._41 + a.y * m._42 + a.z * m._43 + a.w * m._44
		return v ? v.set(x, y, z, w) : new Vec4(x, y, z, w)
	}
	applyMat4 = (m: Mat4) => Vec4.applyMat4(null, m, this)

	static lengthOf = (a: Vec4) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w)
	length = () => Vec4.lengthOf(this)

	static normalize = (v: Vec4 | null, a: Vec4) => {
		const length = Vec4.lengthOf(a)
		const x = a.x / length
		const y = a.y / length
		const z = a.z / length
		const w = a.w / length
		return v ? v.set(x, y, z, w) : new Vec4(x, y, z, w)
	}
	normalize = () => Vec4.normalize(null, this)

	static perspectiveDivide = (v: Vec4 | null, a: Vec4) => {
		const x = a.x / a.w
		const y = a.y / a.w
		const z = a.z / a.w
		return v ? v.set(x, y, z, 1) : new Vec4(x, y, z, 1)
	}

	static scaleBy = (v: Vec4 | null, a: Vec4, s: number) => {
		const x = a.x * s
		const y = a.y * s
		const z = a.z * s
		const w = a.w * s
		return v ? v.set(x, y, z, w) : new Vec4(x, y, z, w)
	}
}
