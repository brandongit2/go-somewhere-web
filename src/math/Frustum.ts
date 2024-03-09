import {type Mat4} from "@/math/Mat4"
import {Plane} from "@/math/Plane"
import {type Sphere} from "@/math/Sphere"

export class Frustum {
	// planes[0] = left
	// planes[1] = right
	// planes[2] = top
	// planes[3] = bottom
	// planes[4] = near
	// planes[5] = far
	planes: Plane[]

	constructor(projectionMatrix: Mat4) {
		this.planes = null! // This assignment is just to satisfy TypeScript; `Frustum.prototype.setFromProjectionMatrix()` is assumed to initialize `this.planes` for real.
		this.setFromProjectionMatrix(projectionMatrix)
	}

	setFromProjectionMatrix(m: Mat4) {
		const mE = m.elements

		this.planes = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane(), new Plane()]
		this.planes[0]!.setComponents(mE[3] - mE[0], mE[7] - mE[4], mE[11] - mE[8], mE[15] - mE[12]).normalize()
		this.planes[1]!.setComponents(mE[3] + mE[0], mE[7] + mE[4], mE[11] + mE[8], mE[15] + mE[12]).normalize()
		this.planes[2]!.setComponents(mE[3] + mE[1], mE[7] + mE[5], mE[11] + mE[9], mE[15] + mE[13]).normalize()
		this.planes[3]!.setComponents(mE[3] - mE[1], mE[7] - mE[5], mE[11] - mE[9], mE[15] - mE[13]).normalize()
		this.planes[4]!.setComponents(mE[3] - mE[2], mE[7] - mE[6], mE[11] - mE[10], mE[15] - mE[14]).normalize()
		this.planes[5]!.setComponents(mE[2], mE[6], mE[10], mE[14]).normalize()

		return this
	}

	intersectsSphere = (sphere: Sphere) => {
		for (let i = 0; i < 6; i++) {
			const distance = this.planes[i]!.distanceToPoint(sphere.center)
			if (distance < -sphere.radius) return false
		}

		return true
	}
}
