import {clamp} from "@/util"

export class Vec3 {
	private _x: number
	private _y: number
	private _z: number

	constructor(x: number, y: number, z: number)
	constructor(xyz: [number, number, number])
	constructor(xOrXyz: number | [number, number, number], y?: number, z?: number) {
		if (typeof xOrXyz === `number`) {
			this._x = xOrXyz
			this._y = y!
			this._z = z!
		} else {
			this._x = xOrXyz[0]
			this._y = xOrXyz[1]
			this._z = xOrXyz[2]
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

	*[Symbol.iterator]() {
		yield this.x
		yield this.y
		yield this.z
	}

	as = <T extends [number, number, number]>() => [this.x, this.y, this.z] as T

	toString = () => `(${this.x}, ${this.y}, ${this.z})`

	toTuple = () => [this.x, this.y, this.z] as [number, number, number]

	get length() {
		if (this.cache.length === undefined) this.cache.length = Vec3.len(this)
		return this.cache.length
	}

	minus = (v: Vec3) => Vec3.sub(this, v)

	normalized = () => Vec3.norm(this)

	plus = (v: Vec3) => Vec3.add(this, v)

	times = (s: number) => Vec3.scale(this, s)

	static add = (a: Vec3, b: Vec3) => new Vec3(a.x + b.x, a.y + b.y, a.z + b.z)

	static angleBetween = (a: Vec3, b: Vec3) => {
		const angle = Vec3.dot(a, b) / (a.length * b.length)
		return Math.acos(clamp(angle, -1, 1))
	}

	static bisect = (a: Vec3, b: Vec3, magnitude?: number) => {
		let sum = Vec3.add(a, b)
		if (sum.length === 0) return new Vec3(0, 0, 0)

		sum = sum.normalized()
		if (magnitude === undefined) return sum
		else return sum.times(magnitude)
	}

	static cross = (a: Vec3, b: Vec3) => new Vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

	static dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

	static len = (v: Vec3) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

	static norm = (v: Vec3) => (v.length === 0 ? v : new Vec3(v.x / v.length, v.y / v.length, v.z / v.length))

	static scale = (v: Vec3, s: number) => new Vec3(v.x * s, v.y * s, v.z * s)

	static sub = (a: Vec3, b: Vec3) => new Vec3(a.x - b.x, a.y - b.y, a.z - b.z)
}
