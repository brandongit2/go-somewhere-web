import {Vec3} from "@/math/Vec3"
import {type Coord3d} from "@/types"
import {degToRad} from "@/util"

// prettier-ignore
type Mat4Elements = [
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
]

export class Mat4 {
	// prettier-ignore
	private _elements: Mat4Elements = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		]

	constructor()
	constructor(elements: Mat4Elements)
	// prettier-ignore
	constructor(
		_11: number, _12: number, _13: number, _14: number,
		_21: number, _22: number, _23: number, _24: number,
		_31: number, _32: number, _33: number, _34: number,
		_41: number, _42: number, _43: number, _44: number,
	)
	// prettier-ignore
	constructor(
		_11OrArr?: number | Mat4Elements, _12?: number, _13?: number, _14?: number,
		_21?: number,                     _22?: number, _23?: number, _24?: number,
		_31?: number,                     _32?: number, _33?: number, _34?: number,
		_41?: number,                     _42?: number, _43?: number, _44?: number,
	) {
		if (_11OrArr === undefined)
			// prettier-ignore
			this.set(
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1,
			)
		else if (typeof _11OrArr === `number`)
			// prettier-ignore
			this.set(
				_11OrArr, _12!, _13!, _14!,
				_21!,     _22!, _23!, _24!,
				_31!,     _32!, _33!, _34!,
				_41!,     _42!, _43!, _44!,
			)
		else this.set(..._11OrArr)
	}

	private cache = {
		inverse: undefined as Mat4 | undefined,
	}

	private clearCache = () => {
		for (const key in this.cache) this.cache[key as keyof typeof this.cache] = undefined
	}

	get elements() {
		return this._elements
	}

	get inverse() {
		if (this.cache.inverse === undefined) this.cache.inverse = Mat4.invert(this)
		return this.cache.inverse
	}

	*[Symbol.iterator]() {
		for (const e of this._elements) yield e
	}

	// prettier-ignore
	set = (
		_11: number, _12: number, _13: number, _14: number,
		_21: number, _22: number, _23: number, _24: number,
		_31: number, _32: number, _33: number, _34: number,
		_41: number, _42: number, _43: number, _44: number,
	) => {
		// prettier-ignore
		this._elements = [
			_11, _21, _31, _41,
			_12, _22, _32, _42,
			_13, _23, _33, _43,
			_14, _24, _34, _44,
		]
		return this
	}

	timesScalar = (s: number) => Mat4.mulScalar(this, s)

	transposed = () => Mat4.transpose(this)

	static invert = (mat: Mat4) => {
		const m = mat._elements

		const a0 = m[0] * m[5] - m[1] * m[4]
		const a1 = m[0] * m[6] - m[2] * m[4]
		const a2 = m[0] * m[7] - m[3] * m[4]
		const a3 = m[1] * m[6] - m[2] * m[5]
		const a4 = m[1] * m[7] - m[3] * m[5]
		const a5 = m[2] * m[7] - m[3] * m[6]
		const b0 = m[8] * m[13] - m[9] * m[12]
		const b1 = m[8] * m[14] - m[10] * m[12]
		const b2 = m[8] * m[15] - m[11] * m[12]
		const b3 = m[9] * m[14] - m[10] * m[13]
		const b4 = m[9] * m[15] - m[11] * m[13]
		const b5 = m[10] * m[15] - m[11] * m[14]

		const det = a0 * b5 - a1 * b4 + a2 * b3 + a3 * b2 - a4 * b1 + a5 * b0
		if (det === 0) throw new Error(`Matrix is not invertible.`)

		const invDet = 1 / det

		// prettier-ignore
		return new Mat4([
			(m[5] * b5 - m[6] * b4 + m[7] * b3) * invDet,
			(-m[1] * b5 + m[2] * b4 - m[3] * b3) * invDet,
			(m[13] * a5 - m[14] * a4 + m[15] * a3) * invDet,
			(-m[9] * a5 + m[10] * a4 - m[11] * a3) * invDet,

			(-m[4] * b5 + m[6] * b2 - m[7] * b1) * invDet,
			(m[0] * b5 - m[2] * b2 + m[3] * b1) * invDet,
			(-m[12] * a5 + m[14] * a2 - m[15] * a1) * invDet,
			(m[8] * a5 - m[10] * a2 + m[11] * a1) * invDet,

			(m[4] * b4 - m[5] * b2 + m[7] * b0) * invDet,
			(-m[0] * b4 + m[1] * b2 - m[3] * b0) * invDet,
			(m[12] * a4 - m[13] * a2 + m[15] * a0) * invDet,
			(-m[8] * a4 + m[9] * a2 - m[11] * a0) * invDet,

			(-m[4] * b3 + m[5] * b1 - m[6] * b0) * invDet,
			(m[0] * b3 - m[1] * b1 + m[2] * b0) * invDet,
			(-m[12] * a3 + m[13] * a1 - m[14] * a0) * invDet,
			(m[8] * a3 - m[9] * a1 + m[10] * a0) * invDet,
		])
	}

	static lookAt = (eye: Vec3, target: Vec3, up: Vec3) => {
		const z = Vec3.sub(eye, target).normalized()
		const x = Vec3.cross(up, z).normalized()
		const y = Vec3.cross(z, x).normalized()

		// prettier-ignore
		return new Mat4([
			x.x, x.y, x.z, -Vec3.dot(x, eye),
			y.x, y.y, y.z, -Vec3.dot(y, eye),
			z.x, z.y, z.z, -Vec3.dot(z, eye),
			0,   0,   0,   1,
		])
	}

	static makeOrthographic = (left: number, right: number, top: number, bottom: number, near: number, far: number) =>
		// prettier-ignore
		new Mat4([
			2 / (right - left), 0,                  0,                -(right + left) / (right - left),
			0,                  2 / (top - bottom), 0,                -(top + bottom) / (top - bottom),
			0,                  0,                  2 / (near - far),  (far + near) / (far - near),
			0,                  0,                  0,                 1,
		])

	static makePerspective = (fovX: number, aspect: number, near: number) => {
		const f = 1 / Math.tan(degToRad(fovX) / 2)
		// prettier-ignore
		return new Mat4([
			f, 0,           0, 0,
			0, f * aspect,  0, 0,
			0, 0,           0, near,
			0, 0,          -1, 0,
		])
	}

	static makeTranslation: MakeTranslation = (xOrXyz: number | Coord3d, y?: number, z?: number) => {
		let xP = typeof xOrXyz === `number` ? xOrXyz : xOrXyz[0]
		let yP = typeof xOrXyz === `number` ? y! : xOrXyz[1]
		let zP = typeof xOrXyz === `number` ? z! : xOrXyz[2]

		// prettier-ignore
		return new Mat4([
			1, 0, 0, xP,
			0, 1, 0, yP,
			0, 0, 1, zP,
			0, 0, 0, 1,
		])
	}

	private static mulImpl = (a: Mat4, b: Mat4) => {
		const aE = a._elements
		const bE = b._elements

		return new Mat4([
			aE[0] * bE[0] + aE[4] * bE[1] + aE[8] * bE[2] + aE[12] * bE[3],
			aE[0] * bE[4] + aE[4] * bE[5] + aE[8] * bE[6] + aE[12] * bE[7],
			aE[0] * bE[8] + aE[4] * bE[9] + aE[8] * bE[10] + aE[12] * bE[11],
			aE[0] * bE[12] + aE[4] * bE[13] + aE[8] * bE[14] + aE[12] * bE[15],

			aE[1] * bE[0] + aE[5] * bE[1] + aE[9] * bE[2] + aE[13] * bE[3],
			aE[1] * bE[4] + aE[5] * bE[5] + aE[9] * bE[6] + aE[13] * bE[7],
			aE[1] * bE[8] + aE[5] * bE[9] + aE[9] * bE[10] + aE[13] * bE[11],
			aE[1] * bE[12] + aE[5] * bE[13] + aE[9] * bE[14] + aE[13] * bE[15],

			aE[2] * bE[0] + aE[6] * bE[1] + aE[10] * bE[2] + aE[14] * bE[3],
			aE[2] * bE[4] + aE[6] * bE[5] + aE[10] * bE[6] + aE[14] * bE[7],
			aE[2] * bE[8] + aE[6] * bE[9] + aE[10] * bE[10] + aE[14] * bE[11],
			aE[2] * bE[12] + aE[6] * bE[13] + aE[10] * bE[14] + aE[14] * bE[15],

			aE[3] * bE[0] + aE[7] * bE[1] + aE[11] * bE[2] + aE[15] * bE[3],
			aE[3] * bE[4] + aE[7] * bE[5] + aE[11] * bE[6] + aE[15] * bE[7],
			aE[3] * bE[8] + aE[7] * bE[9] + aE[11] * bE[10] + aE[15] * bE[11],
			aE[3] * bE[12] + aE[7] * bE[13] + aE[11] * bE[14] + aE[15] * bE[15],
		])
	}

	static mul = (...matrices: Mat4[]) => {
		if (matrices.length === 0) return new Mat4()
		if (matrices.length === 1) return matrices[0]!

		let result = matrices.at(-1)!
		for (let i = matrices.length - 2; i >= 0; i--) result = Mat4.mulImpl(matrices[i]!, result)
		return result
	}

	static mulScalar = (mat: Mat4, s: number) => new Mat4(mat._elements.map((e) => e * s) as Mat4Elements)

	// The constructor already transposes the input so we don't need to do anything here.
	static transpose = (mat: Mat4) => new Mat4(mat._elements)
}

type MakeTranslation = {
	(x: number, y: number, z: number): Mat4
	(xyz: Coord3d): Mat4
}
