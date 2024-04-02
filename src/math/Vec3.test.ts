import test, {expect} from "@playwright/test"

import {Vec3} from "@/math/Vec3"

test(`Add \`Vec3\`s`, () => {
	const a = new Vec3(1, 2, 3)
	const b = new Vec3(4, 5, 6)

	expect(Vec3.add(a, b).toTuple()).toEqual([5, 7, 9])
})

test(`Subtract \`Vec3\`s`, () => {
	const a = new Vec3(1, 2, 3)
	const b = new Vec3(4, 5, 6)

	expect(Vec3.sub(a, b).toTuple()).toEqual([-3, -3, -3])
})

test.describe(`Find dot product of two \`Vec3\`s`, () => {
	const a = new Vec3(1, 2, 3)
	const b = new Vec3(4, 5, 6)

	expect(Vec3.dot(a, b)).toBe(32)
})

test.describe(`Find cross product of two \`Vec3\`s`, () => {
	const a = new Vec3(3, 4, 1)
	const b = new Vec3(2, 4, 0)

	expect(Vec3.cross(a, b).toTuple()).toEqual([-4, 2, 4])
})

test.describe(`Find angle between two \`Vec3\`s`, () => {
	test(`θ = 0`, () => {
		const a = new Vec3(1, 0, 0)
		const b = new Vec3(1, 0, 0)

		expect(Vec3.angleBetween(a, b)).toBe(0)
	})

	test(`0 < θ < π`, () => {
		const a = new Vec3(1, 0, 0)
		const b = new Vec3(0, 1, 0)

		expect(Vec3.angleBetween(a, b)).toBeCloseTo(Math.PI / 2)
	})

	test(`θ = π`, () => {
		const a = new Vec3(1, 0, 0)
		const b = new Vec3(-1, 0, 0)

		expect(Vec3.angleBetween(a, b)).toBeCloseTo(Math.PI)
	})
})

test.describe(`Find distance from one vector to another`, () => {
	const a = new Vec3(1, 2, 3)
	const b = new Vec3(4, 6, 8)

	expect(a.distanceTo(b)).toBeCloseTo(7.07107)
})

test.describe(`Find length of a \`Vec3\``, () => {
	const v = new Vec3(1, 2, 3)

	expect(v.length()).toBeCloseTo(3.74166)
})

test.describe(`Normalize a \`Vec3\``, () => {
	const v = new Vec3(1, 2, 3)
	const n = Vec3.normalize(v)

	expect(n.x).toEqual(0.267261)
	expect(n.y).toEqual(0.534522)
	expect(n.z).toEqual(0.801784)
})
