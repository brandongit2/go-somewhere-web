import {type Promisable} from "type-fest"

import {fovX} from "@/const"
import {Line} from "@/map/features/Line"
import {createMapCanvas, getDepthTexture, type MapCanvas} from "@/map/MapCanvas"
import {MapTile} from "@/map/MapTile"
import {PerspectiveCamera} from "@/map/PerspectiveCamera"
import {Vec3} from "@/math/Vec3"
import {type LngLat, type MapObject, type WindowCoord, type WorldCoord} from "@/types"
import {clamp, degToRad, lngLatToWorld} from "@/util"

export class MapRoot {
	camera: PerspectiveCamera
	cameraPos: LngLat = {lng: 0, lat: 0}
	zoom = 0
	mousePos = [0, 0] as WindowCoord

	children: MapObject[] = []
	beforeNextRender: Array<() => void> = []

	constructor(public canvas: MapCanvas) {
		this.camera = new PerspectiveCamera(this, fovX, 0.00001, 10)

		this.children.push(
			new Line(this, {
				lines: [],
				thickness: 0.01,
				viewPoint: [0, 0, 0] as WorldCoord,
				color: [0, 0.6, 0.2],
			}),
			new MapTile(this, `0/0/0`),
		)

		requestAnimationFrame(() => {
			this.render().catch((err) => {
				throw err
			})
		})
	}

	destroy = () => {
		this.canvas.device.destroy()
	}

	render = async () => {
		const {
			canvas: {canvasContext, depthTexture, device},
		} = this

		const distance = (Math.PI / Math.tan(degToRad(fovX) / 2)) * 2 ** -this.zoom
		const cameraPosWorld = new Vec3(lngLatToWorld(this.cameraPos, distance + 1))
		this.camera.viewMatrix.lookAt(cameraPosWorld, new Vec3(0, 0, 0), new Vec3(0, 1, 0))
		this.camera.updateViewMatrixBuffer()

		this.beforeNextRender.forEach((fn) => fn())
		this.beforeNextRender = []

		const preDrawFns: Array<() => Promisable<void>> = []
		const drawFns: Array<(pass: GPURenderPassEncoder) => void> = []
		const getFns = (node: MapObject) => {
			if (node.preDraw) preDrawFns.push(node.preDraw)
			if (node.draw) drawFns.push(node.draw)
			node.children?.forEach(getFns)
		}
		getFns(this)

		await Promise.allSettled(preDrawFns.map((fn) => fn()))

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: canvasContext.getCurrentTexture().createView({label: `colour texture view`}),
					clearValue: [0, 0, 0, 1],
					loadOp: `clear`,
					storeOp: `store`,
				},
			],
			depthStencilAttachment: {
				view: depthTexture.createView({label: `depth texture view`}),
				depthClearValue: 0,
				depthLoadOp: `clear`,
				depthStoreOp: `store`,
			},
		})

		drawFns.forEach((fn) => fn(pass))

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])

		requestAnimationFrame(() => {
			this.render().catch((err) => {
				throw err
			})
		})
	}

	pan = (dx: number, dy: number) => {
		const {cameraPos, zoom} = this

		const fac = (1 / this.canvas.mapWidth) * 360 * 2 ** -zoom
		let newLng = cameraPos.lng - dx * fac
		if (newLng < -180) newLng += 360
		else if (newLng > 180) newLng -= 360
		this.cameraPos = {
			lng: newLng,
			lat: clamp(cameraPos.lat + dy * fac, -85, 85),
		}
	}

	resize = (width: number, height: number) => {
		this.beforeNextRender[0] = () => {
			const {
				canvas,
				canvas: {depthTexture: oldDepthTexture, device, setMapSize},
			} = this

			const {mapWidth, mapHeight} = setMapSize(width, height)
			this.camera.updateProjectionMatrix()

			canvas.depthTexture = getDepthTexture(device, mapWidth, mapHeight)
			oldDepthTexture.destroy()
		}
	}

	tempZoom = 0
	setZoom = (calc: (zoom: number) => number) => {
		const {beforeNextRender} = this

		this.tempZoom = calc(this.tempZoom)
		beforeNextRender[1] = () => {
			this.zoom = clamp(this.tempZoom, 0, 18)
			this.tempZoom = this.zoom
		}
	}
}

export const createMapRoot = async (canvasElement: HTMLCanvasElement, width: number, height: number) => {
	const mapContext = await createMapCanvas(canvasElement, width, height)
	return new MapRoot(mapContext)
}
