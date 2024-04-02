import {clamp} from "@/util"

export class Vec2 {
	x: number
	y: number

	constructor(xy: [number, number])
	constructor(x: number, y: number)
	constructor(xOrArr: number | [number, number], y?: number) {
		if (Array.isArray(xOrArr)) {
			this.x = xOrArr[0]
			this.y = xOrArr[1]
		} else {
			this.x = xOrArr
			this.y = y!
		}
	}

	as = <T extends [number, number]>() => [this.x, this.y] as T
	toString = () => `(${this.x}, ${this.y})`
	toTuple = () => [this.x, this.y] as [number, number]

	static add = (a: Vec2, b: Vec2) => new Vec2(a.x + b.x, a.y + b.y)
	plus = (v: Vec2) => Vec2.add(this, v)

	static angleBetween = (a: Vec2, b: Vec2) => {
		const angle = Vec2.dot(a, b) / (a.length() * b.length())
		return Math.acos(clamp(angle, -1, 1))
	}

	static dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y
	dot = (v: Vec2) => Vec2.dot(this, v)

	static lengthOf = (v: Vec2) => Math.sqrt(v.x * v.x + v.y * v.y)
	length = () => Vec2.lengthOf(this)

	static normalize = (v: Vec2) => {
		const length = Vec2.lengthOf(v)
		return new Vec2(v.x / length, v.y / length)
	}
	normalized = () => Vec2.normalize(this)

	static scale = (v: Vec2, s: number) => new Vec2(v.x * s, v.y * s)
	scaledBy = (s: number) => Vec2.scale(this, s)

	static sub = (a: Vec2, b: Vec2) => new Vec2(a.x - b.x, a.y - b.y)
	minus = (v: Vec2) => Vec2.sub(this, v)
}
