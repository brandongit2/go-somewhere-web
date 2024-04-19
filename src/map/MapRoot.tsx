import {useEffect, useState, type RefObject} from "react"
import invariant from "tiny-invariant"

import {useAnimationFrame} from "@/hooks/useAnimationFrame"
import {useMapRenderer} from "@/map/map-renderer"
import {useMapState} from "@/map/map-state"
import {clamp} from "@/util"
import {device} from "@/webgpu"

export const MapRoot = () => {
	const canvasRef = useMapState((state) => state.canvasRef)
	const canvasContext = useCanvasContext(canvasRef)
	const [mapWidth, mapHeight] = useMapSize(canvasRef)

	const camera = useMapState((state) => state.camera)
	useEffect(() => {
		camera.updateProjectionMatrix({aspect: mapWidth / mapHeight})
	}, [camera, mapHeight, mapWidth])

	const renderer = useMapRenderer()
	useAnimationFrame((deltaTime, nextFrame) => {
		if (canvasContext) renderer.render(canvasContext)

		nextFrame()
	})

	return <canvas ref={canvasRef} className="h-full w-full touch-none" />
}

const useCanvasContext = (canvasRef: RefObject<HTMLCanvasElement>) => {
	const [canvasContext, setCanvasContext] = useState<GPUCanvasContext | null>(null)
	useEffect(() => {
		invariant(canvasRef.current)

		const canvasContext = canvasRef.current.getContext(`webgpu`)
		if (!canvasContext) throw new Error(`WebGPU not supported.`)
		setCanvasContext(canvasContext)
	}, [canvasRef])
	return canvasContext
}

const useMapSize = (canvasRef: RefObject<HTMLCanvasElement>) => {
	const [mapSize, setMapSize] = useState<[number, number]>([1024, 1024])
	useEffect(() => {
		const onResize = () => {
			invariant(canvasRef.current)

			const mapWidth = clamp(window.innerWidth, 1, device.limits.maxTextureDimension2D)
			const mapHeight = clamp(window.innerHeight, 1, device.limits.maxTextureDimension2D)

			canvasRef.current.width = mapWidth
			canvasRef.current.height = mapHeight
			setMapSize([mapWidth, mapHeight])
		}
		window.addEventListener(`resize`, onResize)
		onResize()
		return () => window.removeEventListener(`resize`, onResize)
	}, [canvasRef])
	return mapSize
}
