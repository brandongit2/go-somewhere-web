"use client"

import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {memo, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import {useAsyncError} from "@/hooks/use-async-error"
import {MapRoot} from "@/map/MapRoot"
import {Vec2} from "@/math/Vec2"
import {type WindowCoord} from "@/types"
import {clamp} from "@/util"

let didInit = false

const MapImpl = () => {
	const throwError = useAsyncError()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const map = useRef<MapRoot | null>(null)

	useEffect(() => {
		if (!map.current) return
		const onResize = map.current.onResize
		window.addEventListener(`resize`, onResize)
		return () => window.removeEventListener(`resize`, onResize)
	}, [])

	useEffect(() => {
		if (didInit) return
		invariant(canvasRef.current)

		MapRoot.create(canvasRef.current)
			.then((root) => {
				map.current = root
			})
			.catch(throwError)
		didInit = true

		return () => {
			map.current?.destroy()
		}
	}, [throwError])

	// Render
	const mousePos = useMotionValue<WindowCoord | null>(null)
	const mousePosWorld = useTransform(mousePos, (mousePos) => {
		if (!map.current?.mapContext || !mousePos) return null

		const {windowWidth, windowHeight, cameraPos: cameraPosObj, zoom} = map.current.mapContext

		const logicalWindowWidth = windowWidth / devicePixelRatio
		const logicalWindowHeight = windowHeight / devicePixelRatio

		const cameraPos = new Vec2(cameraPosObj.lng, cameraPosObj.lat)
		const cursorX = mousePos[0] - logicalWindowWidth / 2
		const cursorY = -(mousePos[1] - logicalWindowHeight / 2)
		return new Vec2(cursorX, cursorY).scaledBy(2 ** -zoom).plus(cameraPos)
	})
	useAnimationFrame(() => {
		if (!map.current?.mapContext) return

		map.current.render().catch(throwError)
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				mousePos.set([event.clientX, event.clientY] as WindowCoord)
			}}
			onPan={(event, info) => {
				if (!map.current?.mapContext) return
				const {cameraPos, zoom} = map.current.mapContext

				const logicalWindowWidth = map.current.mapContext.windowWidth / devicePixelRatio

				const fac = (1 / logicalWindowWidth) * 360 * 2 ** -zoom
				let newLng = cameraPos.lng - info.delta.x * fac
				if (newLng < -180) newLng += 360
				else if (newLng > 180) newLng -= 360
				map.current.mapContext.cameraPos = {
					lng: newLng,
					lat: clamp(cameraPos.lat + info.delta.y * fac, -85, 85),
				}
			}}
			onWheel={(event) => {
				if (!map.current?.mapContext) return
				map.current.setZoom(map.current.mapContext.zoom - event.deltaY / 100)
			}}
		/>
	)
}

export const Map = memo(MapImpl)
