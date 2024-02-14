export class Mat4 {
	constructor(private elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) {}

	set = (
		_11: number,
		_12: number,
		_13: number,
		_14: number,
		_21: number,
		_22: number,
		_23: number,
		_24: number,
		_31: number,
		_32: number,
		_33: number,
		_34: number,
		_41: number,
		_42: number,
		_43: number,
		_44: number,
	) => {
		this.elements = [_11, _12, _13, _14, _21, _22, _23, _24, _31, _32, _33, _34, _41, _42, _43, _44]
		return this
	}

	timesScalar = (s: number) => Mat4.mulScalar(this, s)

	static fromPerspective = (fov: number, aspect: number, near: number, far: number) => {
		const f = 1 / Math.tan(fov / 2)
		const nf = 1 / (near - far)

		return new Mat4([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0])
	}

	static mul = (a: Mat4, b: Mat4) => {
		const aE = a.elements
		const bE = b.elements

		const a11 = aE[0],
			a12 = aE[4],
			a13 = aE[8],
			a14 = aE[12]
		const a21 = aE[1],
			a22 = aE[5],
			a23 = aE[9],
			a24 = aE[13]
		const a31 = aE[2],
			a32 = aE[6],
			a33 = aE[10],
			a34 = aE[14]
		const a41 = aE[3],
			a42 = aE[7],
			a43 = aE[11],
			a44 = aE[15]

		const b11 = bE[0],
			b12 = bE[4],
			b13 = bE[8],
			b14 = bE[12]
		const b21 = bE[1],
			b22 = bE[5],
			b23 = bE[9],
			b24 = bE[13]
		const b31 = bE[2],
			b32 = bE[6],
			b33 = bE[10],
			b34 = bE[14]
		const b41 = bE[3],
			b42 = bE[7],
			b43 = bE[11],
			b44 = bE[15]

		const cE: number[] = []

		cE[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
		cE[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
		cE[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
		cE[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44

		cE[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
		cE[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
		cE[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
		cE[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44

		cE[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
		cE[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
		cE[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
		cE[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44

		cE[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
		cE[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
		cE[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
		cE[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44

		return new Mat4(cE)
	}

	static mulScalar = (mat: Mat4, s: number) => new Mat4(mat.elements.map((e) => e * s))
}
