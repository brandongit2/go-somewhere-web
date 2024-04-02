import {type TileManager} from "@/map/TileManager"
import {type LngLat} from "@/types"

export type MapContext = {
	windowHeight: number
	windowWidth: number
	cameraPos: LngLat
	zoom: number
	tileManager: TileManager

	canvasContext: GPUCanvasContext
	canvasElement: HTMLCanvasElement
	device: GPUDevice
	presentationFormat: GPUTextureFormat
	depthTexture: GPUTexture
	viewMatrixBuffer: GPUBuffer
}
