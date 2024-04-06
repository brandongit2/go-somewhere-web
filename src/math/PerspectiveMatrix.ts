import {Mat4} from "@/math/Mat4"
import {degToRad} from "@/util"

export class PerspectiveMatrix extends Mat4 {
	nearWidth: number
	nearHeight: number

	constructor(
		public fovX: number,
		public aspect: number,
		public near: number,
		public far: number,
	) {
		super()

		const t = Math.tan(degToRad(fovX) / 2)
		this.nearWidth = 2 * near * t
		this.nearHeight = this.nearWidth / aspect

		const f = 1 / t
		const r = 1 / (far - near)
		// prettier-ignore
		this.set(
			f, 0,           0,        0,
			0, f * aspect,  0,        0,
			0, 0,           near * r, near * far * r,
			0, 0,          -1,        0,
		)
	}
}
