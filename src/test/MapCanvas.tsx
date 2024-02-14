import type {ReactNode} from "react"

export type MapCanvasProps = {
	children: ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MapCanvas({children}: MapCanvasProps) {
	return <canvas />
}
