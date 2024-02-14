type Elements = [number, number, number, number, number, number, number, number, number]

export class Mat3 {
	private _elements: Elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]

	constructor(...elements: Elements) {
		this._elements = elements
	}

	set = (
		_11: number,
		_12: number,
		_13: number,
		_21: number,
		_22: number,
		_23: number,
		_31: number,
		_32: number,
		_33: number,
	) => {
		this._elements = [_11, _12, _13, _21, _22, _23, _31, _32, _33]
		return this
	};

	*[Symbol.iterator]() {
		for (const e of this._elements) yield e
	}

	timesScalar = (s: number) => Mat3.mulScalar(this, s)

	static fromTranslation = (x: number, y: number, z: number) => new Mat3(1, 0, x, 0, 1, y, 0, 0, z)

	static mul = (a: Mat3, b: Mat3) => {
		const aE = a._elements
		const bE = b._elements

		const a11 = aE[0],
			a12 = aE[3],
			a13 = aE[6]
		const a21 = aE[1],
			a22 = aE[4],
			a23 = aE[7]
		const a31 = aE[2],
			a32 = aE[5],
			a33 = aE[8]

		const b11 = bE[0],
			b12 = bE[3],
			b13 = bE[6]
		const b21 = bE[1],
			b22 = bE[4],
			b23 = bE[7]
		const b31 = bE[2],
			b32 = bE[5],
			b33 = bE[8]

		const cE: number[] = []

		cE[0] = a11 * b11 + a12 * b21 + a13 * b31
		cE[3] = a11 * b12 + a12 * b22 + a13 * b32
		cE[6] = a11 * b13 + a12 * b23 + a13 * b33

		cE[1] = a21 * b11 + a22 * b21 + a23 * b31
		cE[4] = a21 * b12 + a22 * b22 + a23 * b32
		cE[7] = a21 * b13 + a22 * b23 + a23 * b33

		cE[2] = a31 * b11 + a32 * b21 + a33 * b31
		cE[5] = a31 * b12 + a32 * b22 + a33 * b32
		cE[8] = a31 * b13 + a32 * b23 + a33 * b33

		return new Mat3(...(cE as Elements))
	}

	static mulScalar = (m: Mat3, s: number) => new Mat3(...(m._elements.map((e) => e * s) as Elements))
}
