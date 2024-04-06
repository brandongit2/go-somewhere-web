import {Vec3} from "@/math/Vec3"

export class Plane {
	constructor(
		public normal = new Vec3(1, 0, 0),
		public distance = 0,
	) {}

	static normalize = (p: Plane) => {
		const inverseNormalLength = 1 / p.normal.length()
		p.normal.scaleBy(inverseNormalLength)
		p.distance *= inverseNormalLength
		return p
	}
	normalize = () => Plane.normalize(this)

	static distanceToPoint = (a: Plane, point: Vec3) => Vec3.dot(a.normal, point) + a.distance
	distanceToPoint = (point: Vec3) => Plane.distanceToPoint(this, point)
}
