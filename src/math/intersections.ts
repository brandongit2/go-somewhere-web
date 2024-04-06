import {type Mat4} from "@/math/Mat4"
import {type Obb} from "@/math/Obb"
import {type PerspectiveMatrix} from "@/math/PerspectiveMatrix"
import {Vec3} from "@/math/Vec3"

// Runs a separating-axis test between an OBB and a projection matrix frustum: https://bruop.github.io/improved_frustum_culling/
// export const frustumObbIntersection = (projectionMatrix: PerspectiveMatrix, viewMatrix: Mat4, obb: Obb) => {
// 	const center = Vec3.clone(obb.center).applyQuaternion(obb.orientation).applyMat4(viewMatrix)
// 	const obbAxes = [
// 		new Vec3(obb.halfSizes.x, 0, 0).applyQuaternion(obb.orientation).applyMat4(viewMatrix),
// 		new Vec3(0, obb.halfSizes.y, 0).applyQuaternion(obb.orientation).applyMat4(viewMatrix),
// 		new Vec3(0, 0, obb.halfSizes.z).applyQuaternion(obb.orientation).applyMat4(viewMatrix),
// 	] as const
// 	const obbHalfExtents = [obbAxes[0].length(), obbAxes[1].length(), obbAxes[2].length()] as const
// 	Vec3.scaleBy(obbAxes[0], obbAxes[0], 1 / obbHalfExtents[0])
// 	Vec3.scaleBy(obbAxes[1], obbAxes[1], 1 / obbHalfExtents[1])
// 	Vec3.scaleBy(obbAxes[2], obbAxes[2], 1 / obbHalfExtents[2])

// 	// Check for the OBB axes
// 	for (let i = 0; i < obbAxes.length; i++) {
// 		const obbCenter = Vec3.dot(obbAxes[i]!, center)
// 		const obbRadius = obbHalfExtents[i]!
// 		const obbMin = obbCenter - obbRadius
// 		const obbMax = obbCenter + obbRadius

// 		const frustumD = obbAxes[i]!.x * projectionMatrix.nearWidth + obbAxes[i]!.y * projectionMatrix.nearHeight
// 		let tau0 = projectionMatrix.near * obbAxes[i]!.z - frustumD
// 		let tau1 = projectionMatrix.near * obbAxes[i]!.z + frustumD
// 		if (tau0 < 0) tau0 *= projectionMatrix.far / projectionMatrix.near
// 		if (tau1 < 0) tau1 *= projectionMatrix.far / projectionMatrix.near

// 		if (obbMin > tau1 || obbMax < tau0) return false
// 	}

// 	// Check for the $n_4$ axis
// 	{
// 		const obbCenter = center.z
// 		let obbRadius = 0
// 		for (let i = 0; i < 3; i++) obbRadius += Math.abs(obbAxes[i]!.z) * obbHalfExtents[i]!
// 		const obbMin = obbCenter - obbRadius
// 		const obbMax = obbCenter + obbRadius

// 		const tau0 = projectionMatrix.far
// 		const tau1 = projectionMatrix.near

// 		if (obbMin > tau1 || obbMax < tau0) return false
// 	}

// 	// Check for the other frustum axes
// 	const frustumAxes = [
// 		new Vec3(0, projectionMatrix.near, projectionMatrix.nearHeight / 2),
// 		new Vec3(0, -projectionMatrix.near, projectionMatrix.nearHeight / 2),
// 		new Vec3(-projectionMatrix.near, 0, projectionMatrix.nearWidth / 2),
// 		new Vec3(projectionMatrix.near, 0, projectionMatrix.nearWidth / 2),
// 	]
// 	for (const axis of frustumAxes) {
// 		const obbCenter = Vec3.dot(axis, center)
// 		let obbRadius = 0
// 		for (let i = 0; i < 3; i++) obbRadius += Math.abs(Vec3.dot(axis, obbAxes[i]!)) * obbHalfExtents[i]!
// 		const obbMin = obbCenter - obbRadius
// 		const obbMax = obbCenter + obbRadius

// 		const tau1 = 0
// 		const tau2 = -axis.x * projectionMatrix.nearWidth - axis.y * projectionMatrix.nearHeight
// 		// const frustumR =

// 		// if (obbMin > tau1 || obbMax < tau0) return false
// 	}
// }
