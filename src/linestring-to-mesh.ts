import {Vector2} from "three-two-one"

export const linestringToMesh = (linestring: number[]) => {
	for (let i = 0; i < linestring.length - 1; i++) {
		const segment = new Vector2(linestring[i], linestring[i + 1])
	}
}
