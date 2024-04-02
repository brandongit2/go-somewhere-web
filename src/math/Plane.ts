import {Vec3} from "@/math/Vec3"

export class Plane {
	constructor(
		public normal = new Vec3(1, 0, 0),
		public constant = 0,
	) {}

	setComponents(x: number, y: number, z: number, w: number) {
		this.normal.set(x, y, z)
		this.constant = w
		return this
	}

	normalize() {
		const inverseNormalLength = 1.0 / this.normal.length()
		this.normal = this.normal.scaledBy(inverseNormalLength)
		this.constant *= inverseNormalLength
		return this
	}

	distanceToPoint(point: Vec3) {
		return Vec3.dot(this.normal, point) + this.constant
	}
}
