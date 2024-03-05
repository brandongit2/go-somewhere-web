import {type Mat4} from "@/math/Mat4"
import {Vec3} from "@/math/Vec3"

export class Vec4 {
	private _x: number
	private _y: number
	private _z: number
	private _w: number

	constructor(x: number, y: number, z: number, w: number)
	constructor(xyzw: [number, number, number, number])
	constructor(xOrXyzw: number | [number, number, number, number], y?: number, z?: number, w?: number) {
		if (typeof xOrXyzw === `number`) {
			this._x = xOrXyzw
			this._y = y!
			this._z = z!
			this._w = w!
		} else {
			this._x = xOrXyzw[0]
			this._y = xOrXyzw[1]
			this._z = xOrXyzw[2]
			this._w = xOrXyzw[3]
		}
	}

	private cache = {
		length: undefined as number | undefined,
	}

	private clearCache = () => {
		for (const key in this.cache) this.cache[key as keyof typeof this.cache] = undefined
	}

	set x(x: number) {
		this._x = x
		this.clearCache()
	}

	get x() {
		return this._x
	}

	set y(y: number) {
		this._y = y
		this.clearCache()
	}

	get y() {
		return this._y
	}

	set z(z: number) {
		this._z = z
		this.clearCache()
	}

	get z() {
		return this._z
	}

	set w(w: number) {
		this._w = w
		this.clearCache()
	}

	get w() {
		return this._w
	}

	*[Symbol.iterator]() {
		yield this.x
		yield this.y
		yield this.z
		yield this.w
	}

	as = <T extends [number, number, number, number]>() => [this.x, this.y, this.z, this.w] as T

	toString = () => `(${this.x.toFixed(5)}, ${this.y.toFixed(5)}, ${this.z.toFixed(5)}, ${this.w.toFixed(5)})`

	toTuple = () => [this.x, this.y, this.z, this.w] as [number, number, number, number]

	get length() {
		if (this.cache.length === undefined) this.cache.length = Vec4.len(this)
		return this.cache.length
	}

	minus = (v: Vec4) => Vec4.sub(this, v)

	normalized = () => Vec4.norm(this)

	plus = (v: Vec4) => Vec4.add(this, v)

	times = (s: number) => Vec4.scale(this, s)

	static add = (a: Vec4, b: Vec4) => new Vec4(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w)

	static applyMat4 = (v: Vec4, m: Mat4) => {
		const mE = m.elements
		const x = v.x * mE[0] + v.y * mE[4] + v.z * mE[8] + v.w * mE[12]
		const y = v.x * mE[1] + v.y * mE[5] + v.z * mE[9] + v.w * mE[13]
		const z = v.x * mE[2] + v.y * mE[6] + v.z * mE[10] + v.w * mE[14]
		const w = v.x * mE[3] + v.y * mE[7] + v.z * mE[11] + v.w * mE[15]
		return new Vec4(x, y, z, w)
	}

	static len = (v: Vec4) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w)

	static norm = (v: Vec4) =>
		v.length === 0 ? v : new Vec4(v.x / v.length, v.y / v.length, v.z / v.length, v.w / v.length)

	static perspectiveDivide = (v: Vec4) => new Vec3(v.x / v.w, v.y / v.w, v.z / v.w)

	static scale = (v: Vec4, s: number) => new Vec4(v.x * s, v.y * s, v.z * s, v.w * s)

	static sub = (a: Vec4, b: Vec4) => new Vec4(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w)
}
