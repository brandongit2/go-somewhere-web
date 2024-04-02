import {type Vec3} from "@/math/Vec3"

export class Quaternion {
	_x: number
	_y: number
	_z: number
	_w: number

	constructor(x: number, y: number, z: number, w: number) {
		this._x = x
		this._y = y
		this._z = z
		this._w = w
	}

	get x() {
		return this._x
	}

	get y() {
		return this._y
	}

	get z() {
		return this._z
	}

	get w() {
		return this._w
	}

	static fromAxisAngle = (axis: Vec3, angle: number) => {
		const halfAngle = angle / 2
		const s = Math.sin(halfAngle)
		return new Quaternion(axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle))
	}
}
