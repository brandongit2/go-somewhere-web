"use client"

import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {memo, useCallback, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import {useAsyncError} from "@/hooks/use-async-error"
import {type MapContext} from "@/map/MapContext"
import {MapRoot} from "@/map/MapRoot"
import {Vec2} from "@/math/Vec2"
import {type WindowCoord} from "@/types"
import {clamp} from "@/util"

const MapImpl = () => {
	const throwError = useAsyncError()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const mapRoot = useRef<MapRoot | null>(null)
	const mapContext = useRef<MapContext | null>(null)

	const handleResize = useCallback(() => {
		if (!mapRoot.current || !mapContext.current) return

		const {canvasElement, device} = mapContext.current

		mapContext.current.windowWidth = clamp(
			canvasElement.getBoundingClientRect().width * devicePixelRatio,
			1,
			device.limits.maxTextureDimension2D,
		)
		mapContext.current.windowHeight = clamp(
			canvasElement.getBoundingClientRect().height * devicePixelRatio,
			1,
			device.limits.maxTextureDimension2D,
		)
		mapRoot.current.updateCamera()
	}, [])
	useEffect(() => {
		window.addEventListener(`resize`, handleResize)
		return () => window.removeEventListener(`resize`, handleResize)
	}, [handleResize])

	useEffect(() => {
		invariant(canvasRef.current)

		MapRoot.create(canvasRef.current)
			.then(([root, context]) => {
				mapRoot.current = root
				mapContext.current = context
				handleResize()
			})
			.catch(throwError)

		return () => {
			if (mapRoot.current) mapRoot.current.destroy()
		}
	}, [handleResize, throwError])

	// Render
	const mousePos = useMotionValue<WindowCoord | null>(null)
	const mousePosWorld = useTransform(mousePos, (mousePos) => {
		if (!mapContext.current || !mousePos) return null

		const {windowWidth, windowHeight, cameraPos: cameraPosObj, degreesPerPx} = mapContext.current

		const logicalWindowWidth = windowWidth / devicePixelRatio
		const logicalWindowHeight = windowHeight / devicePixelRatio

		const cameraPos = new Vec2(cameraPosObj.lng, cameraPosObj.lat)
		const cursorX = mousePos[0] - logicalWindowWidth / 2
		const cursorY = -(mousePos[1] - logicalWindowHeight / 2)
		return new Vec2(cursorX, cursorY).times(degreesPerPx).plus(cameraPos)
	})
	const zoomChangeAmount = useRef(0)
	useAnimationFrame(() => {
		if (!mapRoot.current || !mapContext.current) return
		const {windowHeight, windowWidth, cameraPos, zoom, degreesPerPx} = mapContext.current

		const logicalWindowWidth = windowWidth / devicePixelRatio
		const logicalWindowHeight = windowHeight / devicePixelRatio

		const mp = mousePos.get()
		const mpw = mousePosWorld.get()
		if (zoomChangeAmount.current && mp && mpw) {
			const newZoom = clamp(zoom - zoomChangeAmount.current, 0, 18)
			const scaleChange = 2 ** (newZoom - zoom)

			mapContext.current.cameraPos = {
				lng: clamp(cameraPos.lng + (mp[0] - logicalWindowWidth / 2) * (1 - 1 / scaleChange) * degreesPerPx, -180, 180),
				lat: clamp(cameraPos.lat - (mp[1] - logicalWindowHeight / 2) * (1 - 1 / scaleChange) * degreesPerPx, -85, 85),
			}
			mapContext.current.zoom = newZoom

			mapRoot.current.updateCamera()
			zoomChangeAmount.current = 0
		}

		mapRoot.current.render()
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				mousePos.set([event.clientX, event.clientY] as WindowCoord)
			}}
			onPan={(event, info) => {
				if (!mapRoot.current || !mapContext.current) return
				const {cameraPos, degreesPerPx} = mapContext.current

				let newLng = cameraPos.lng - info.delta.x * degreesPerPx
				if (newLng < -180) newLng += 360
				else if (newLng > 180) newLng -= 360
				mapContext.current.cameraPos = {
					lng: newLng,
					lat: clamp(cameraPos.lat + info.delta.y * degreesPerPx, -85, 85),
				}
				mapRoot.current.updateCamera()
			}}
			onWheel={(event) => {
				zoomChangeAmount.current += event.deltaY * 0.01
			}}
		/>
	)
}

export const Map = memo(MapImpl)
