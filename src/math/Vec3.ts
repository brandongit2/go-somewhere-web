export class Vec3 {
	constructor(
		private _x: number,
		private _y: number,
		private _z: number,
	) {}

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

	toString = () => `(${this.x}, ${this.y}, ${this.z})`

	get length() {
		if (this.cache.length === undefined) this.cache.length = Vec3.len(this)
		return this.cache.length
	}

	normalized = () => Vec3.norm(this)

	times = (s: number) => Vec3.scale(this, s)

	static add = (a: Vec3, b: Vec3) => new Vec3(a.x + b.x, a.y + b.y, a.z + b.z)

	static dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

	static len = (v: Vec3) => Math.sqrt(Vec3.dot(v, v))

	static norm = (v: Vec3) => Vec3.scale(v, 1 / v.length)

	static scale = (v: Vec3, s: number) => new Vec3(v.x * s, v.y * s, v.z * s)

	static sub = (a: Vec3, b: Vec3) => new Vec3(a.x - b.x, a.y - b.y, a.z - b.z)
}
