import {Vec3} from "@/math/Vec3"

// prettier-ignore
// `Mat4Elements` is always in column-major order.
type Mat4Elements = [
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
]

export class Mat4 {
	_11: number = null!
	_12: number = null!
	_13: number = null!
	_14: number = null!
	_21: number = null!
	_22: number = null!
	_23: number = null!
	_24: number = null!
	_31: number = null!
	_32: number = null!
	_33: number = null!
	_34: number = null!
	_41: number = null!
	_42: number = null!
	_43: number = null!
	_44: number = null!

	constructor()
	constructor(a: Mat4)
	constructor(elements: Mat4Elements)
	constructor(v1: Vec3, v2: Vec3, v3: Vec3)
	// prettier-ignore
	constructor(
		_11: number, _12: number, _13: number, _14: number,
		_21: number, _22: number, _23: number, _24: number,
		_31: number, _32: number, _33: number, _34: number,
		_41: number, _42: number, _43: number, _44: number,
	)
	// prettier-ignore
	constructor(
		_11?: number | Mat4 | Mat4Elements | Vec3, _12?: number | Vec3, _13?: number | Vec3, _14?: number,
		_21?: number,                              _22?: number,        _23?: number,        _24?: number,
		_31?: number,                              _32?: number,        _33?: number,        _34?: number,
		_41?: number,                              _42?: number,        _43?: number,        _44?: number,
	) {
		if (_11 === undefined) {
			this.set(
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1,
			)
		} else if (typeof _11 === `number`) {
			this.set(
				_11,  _12 as number, _13 as number, _14!,
				_21!, _22!,          _23!,          _24!,
				_31!, _32!,          _33!,          _34!,
				_41!, _42!,          _43!,          _44!,
			)
		}
		else if (_11 instanceof Mat4) this.set(_11)
		else if (_11 instanceof Vec3) this.set(_11, _12 as Vec3, _13 as Vec3)
		else this.set(_11)
	}

	// prettier-ignore
	set: {
		(a: Mat4): Mat4
		(elements: Mat4Elements): Mat4
		(v1: Vec3, v2: Vec3, v3: Vec3): Mat4
		(
			_11: number, _12: number, _13: number, _14: number,
			_21: number, _22: number, _23: number, _24: number,
			_31: number, _32: number, _33: number, _34: number,
			_41: number, _42: number, _43: number, _44: number,
		): Mat4
	} = (
		_11OrOthers: number | Mat4 | Mat4Elements | Vec3, _12OrV2?: number | Vec3, _13OrV3?: number | Vec3, _14?: number,
		_21?: number,                                     _22?: number,            _23?: number,            _24?: number,
		_31?: number,                                     _32?: number,            _33?: number,            _34?: number,
		_41?: number,                                     _42?: number,            _43?: number,            _44?: number,
	) => {
		if (_11OrOthers instanceof Mat4) {
			const m = _11OrOthers
			this._11 = m._11; this._12 = m._12; this._13 = m._13; this._14 = m._14
			this._21 = m._21; this._22 = m._22; this._23 = m._23; this._24 = m._24
			this._31 = m._31; this._32 = m._32; this._33 = m._33; this._34 = m._34
			this._41 = m._41; this._42 = m._42; this._43 = m._43; this._44 = m._44
		} else if (Array.isArray(_11OrOthers)) {
			const e = _11OrOthers
			this._11 = e[0];  this._12 = e[4];  this._13 = e[8];  this._14 = e[12]
			this._21 = e[1];  this._22 = e[5];  this._23 = e[9];  this._24 = e[13]
			this._31 = e[2];  this._32 = e[6];  this._33 = e[10]; this._34 = e[14]
			this._41 = e[3];  this._42 = e[7];  this._43 = e[11]; this._44 = e[15]
		} else if (_11OrOthers instanceof Vec3) {
			const v1 = _11OrOthers, v2 = _12OrV2 as Vec3, v3 = _13OrV3 as Vec3
			this._11 = v1.x; this._12 = v2.x; this._13 = v3.x; this._14 = 0
			this._21 = v1.y; this._22 = v2.y; this._23 = v3.y; this._24 = 0
			this._31 = v1.z; this._32 = v2.z; this._33 = v3.z; this._34 = 0
			this._41 = 0;    this._42 = 0;    this._43 = 0;    this._44 = 1
		} else {
			this._11 = _11OrOthers; this._12 = _12OrV2 as number; this._13 = _13OrV3 as number; this._14 = _14!
			this._21 = _21!;        this._22 = _22!;              this._23 = _23!;              this._24 = _24!
			this._31 = _31!;        this._32 = _32!;              this._33 = _33!;              this._34 = _34!
			this._41 = _41!;        this._42 = _42!;              this._43 = _43!;              this._44 = _44!
		}
		return this
	}

	toTuple() {
		// prettier-ignore
		return [
			this._11, this._21, this._31, this._41,
			this._12, this._22, this._32, this._42,
			this._13, this._23, this._33, this._43,
			this._14, this._24, this._34, this._44,
		] as Mat4Elements
	}

	// prettier-ignore
	// This yields elements in column-major order, just like `Mat4Elements`.
	*[Symbol.iterator]() {
		yield this._11; yield this._21; yield this._31; yield this._41
		yield this._12; yield this._22; yield this._32; yield this._42
		yield this._13; yield this._23; yield this._33; yield this._43
		yield this._14; yield this._24; yield this._34; yield this._44
	}

	private static mulImpl = (m: Mat4, a: Mat4, b: Mat4) => {
		m._11 = a._11 * b._11 + a._12 * b._21 + a._13 * b._31 + a._14 * b._41
		m._12 = a._11 * b._12 + a._12 * b._22 + a._13 * b._32 + a._14 * b._42
		m._13 = a._11 * b._13 + a._12 * b._23 + a._13 * b._33 + a._14 * b._43
		m._14 = a._11 * b._14 + a._12 * b._24 + a._13 * b._34 + a._14 * b._44

		m._21 = a._21 * b._11 + a._22 * b._21 + a._23 * b._31 + a._24 * b._41
		m._22 = a._21 * b._12 + a._22 * b._22 + a._23 * b._32 + a._24 * b._42
		m._23 = a._21 * b._13 + a._22 * b._23 + a._23 * b._33 + a._24 * b._43
		m._24 = a._21 * b._14 + a._22 * b._24 + a._23 * b._34 + a._24 * b._44

		m._31 = a._31 * b._11 + a._32 * b._21 + a._33 * b._31 + a._34 * b._41
		m._32 = a._31 * b._12 + a._32 * b._22 + a._33 * b._32 + a._34 * b._42
		m._33 = a._31 * b._13 + a._32 * b._23 + a._33 * b._33 + a._34 * b._43
		m._34 = a._31 * b._14 + a._32 * b._24 + a._33 * b._34 + a._34 * b._44

		m._41 = a._41 * b._11 + a._42 * b._21 + a._43 * b._31 + a._44 * b._41
		m._42 = a._41 * b._12 + a._42 * b._22 + a._43 * b._32 + a._44 * b._42
		m._43 = a._41 * b._13 + a._42 * b._23 + a._43 * b._33 + a._44 * b._43
		m._44 = a._41 * b._14 + a._42 * b._24 + a._43 * b._34 + a._44 * b._44

		return m
	}
	static multiply = (m: Mat4 | null, ...matrices: Mat4[]) => {
		m = m ?? new Mat4()
		if (matrices.length === 0) return m

		m.set(matrices.at(-1)!)
		if (matrices.length === 1) return m

		for (let i = matrices.length - 2; i >= 0; i--) {
			Mat4.mulImpl(swap, matrices[i]!, m)
			m.set(swap)
		}
		return m
	}

	static extractBasis = (v1: Vec3, v2: Vec3, v3: Vec3, a: Mat4) => {
		v1.set(a._11, a._21, a._31)
		v2.set(a._12, a._22, a._32)
		v3.set(a._13, a._23, a._33)
	}
	extractBasis = (v1: Vec3, v2: Vec3, v3: Vec3) => Mat4.extractBasis(v1, v2, v3, this)

	static lookAt = (m: Mat4, eye: Vec3, target: Vec3, up: Vec3) => {
		const z = Vec3.subtract(null, eye, target).normalize()
		const x = Vec3.cross(null, up, z).normalize()
		const y = Vec3.cross(null, z, x).normalize()

		// prettier-ignore
		m.set(
			x.x, x.y, x.z, -Vec3.dot(x, eye),
			y.x, y.y, y.z, -Vec3.dot(y, eye),
			z.x, z.y, z.z, -Vec3.dot(z, eye),
			0,   0,   0,    1,
		)
		return m
	}
	lookAt = (eye: Vec3, target: Vec3, up: Vec3) => Mat4.lookAt(this, eye, target, up)
}

// Certain operations necessitate a temporary matrix to store intermediate results.
const swap = new Mat4()
