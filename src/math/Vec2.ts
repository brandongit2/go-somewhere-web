import {clamp} from "@/util"

export class Vec2 {
	private _x: number
	private _y: number

	constructor(xy: [number, number])
	constructor(x: number, y: number)
	constructor(xOrArr: number | [number, number], y?: number) {
		if (Array.isArray(xOrArr)) {
			this._x = xOrArr[0]
			this._y = xOrArr[1]
		} else {
			this._x = xOrArr
			this._y = y!
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

	*[Symbol.iterator]() {
		yield this.x
		yield this.y
	}

	as = <T extends [number, number]>() => [this.x, this.y] as T

	toString = () => `(${this.x}, ${this.y})`

	toTuple = () => [this.x, this.y] as [number, number]

	get length() {
		if (this.cache.length === undefined) this.cache.length = Vec2.len(this)
		return this.cache.length
	}

	minus = (v: Vec2) => Vec2.sub(this, v)

	normalized = () => Vec2.norm(this)

	plus = (v: Vec2) => Vec2.add(this, v)

	times = (s: number) => Vec2.scale(this, s)

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

	static norm = (v: Vec2) => (v.length === 0 ? v : new Vec2(v.x / v.length, v.y / v.length))

	static scale = (v: Vec2, s: number) => new Vec2(v.x * s, v.y * s)

	static sub = (a: Vec2, b: Vec2) => new Vec2(a.x - b.x, a.y - b.y)
}
