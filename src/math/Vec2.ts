import {clamp} from "./math-plus"

export class Vec2 {
	constructor(
		private _x: number,
		private _y: number,
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

	*[Symbol.iterator]() {
		yield this.x
		yield this.y
	}

	toString = () => `(${this.x}, ${this.y})`

	get length() {
		if (this.cache.length === undefined) this.cache.length = Vec2.len(this)
		return this.cache.length
	}

	normalized = () => Vec2.norm(this)

	times = (s: number) => Vec2.mul(this, s)

	static add = (a: Vec2, b: Vec2) => new Vec2(a.x + b.x, a.y + b.y)

	static angleBetween = (a: Vec2, b: Vec2) => {
		const angle = Vec2.dot(a, b) / (a.length * b.length)
		return Math.acos(clamp(angle, -1, 1))
	}

	static bisect = (a: Vec2, b: Vec2, magnitude?: number) => {
		let sum = Vec2.add(a, b)
		if (sum.length === 0) return new Vec2(0, 0)

		sum = sum.normalized()
		if (magnitude === undefined) return sum
		else return sum.times(magnitude)
	}

	static dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y

	static len = (v: Vec2) => Math.sqrt(v.x * v.x + v.y * v.y)

	static mul = (v: Vec2, s: number) => new Vec2(v.x * s, v.y * s)

	static norm = (v: Vec2) => (v.length === 0 ? v : new Vec2(v.x / v.length, v.y / v.length))

	static sub = (a: Vec2, b: Vec2) => new Vec2(a.x - b.x, a.y - b.y)
}
