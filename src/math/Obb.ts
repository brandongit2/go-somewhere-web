import {type Mat4} from "@/math/Mat4"
import {type Vec3} from "@/math/Vec3"

// Object-oriented bounding box
export class Obb {
	constructor(
		public center: Vec3,
		public halfSizes: Vec3,
		public orientation: Mat4,
	) {}
}
