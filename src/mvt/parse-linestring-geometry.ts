import {commandTypes, decodeParameterInteger} from "./util"
import {linestringToMesh} from "@/linestring-to-mesh"

export const parseLineStringGeometry = (geometry: number[], extent: number) => {
	let integerType: "command" | "parameter" = `command`
	let commandType: number | null = null
	let commandsLeft = 0
	let cursor: [number, number] = [0, 0]
	let linestrings: number[][] = [[]]
	for (let i = 0; i < geometry.length; i++) {
		const integer = geometry[i]
		const latestLinestring = linestrings.at(-1)!

		switch (integerType) {
			case `command`: {
				commandType = integer & 0x7
				const commandCount = integer >> 3
				commandsLeft = commandCount

				if (commandType === commandTypes.moveTo) linestrings.push([])

				integerType = `parameter`

				break
			}
			case `parameter`: {
				const x = cursor[0] + decodeParameterInteger(integer)
				const y = cursor[1] + decodeParameterInteger(geometry[i + 1])
				latestLinestring.push(x / extent, y / extent)
				cursor = [x, y]
				i++

				commandsLeft--
			}
		}

		if (commandsLeft === 0) integerType = `command`
	}

	return linestrings.map((linestring) =>
		linestringToMesh(
			linestring.map((vertex, i) => (i % 2 === 0 ? vertex : 1 - vertex)),
			0.02,
		),
	)
}
