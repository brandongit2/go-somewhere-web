"use client"

import {memo, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import {useAsyncError} from "@/hooks/use-async-error"
import {type MapRoot, createMapRoot} from "@/map/MapRoot"

let didInit = false

const MapImpl = () => {
	const throwError = useAsyncError()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const map = useRef<MapRoot | null>(null)

	useEffect(() => {
		const onResize = () => {
			map.current?.resize(window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio)
		}
		window.addEventListener(`resize`, onResize)
		return () => window.removeEventListener(`resize`, onResize)
	}, [])

	useEffect(() => {
		if (didInit) return
		invariant(canvasRef.current)

		createMapRoot(canvasRef.current, window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio)
			.then((root) => {
				map.current = root
			})
			.catch(throwError)
		didInit = true

		return () => {
			map.current?.destroy()
		}
	}, [throwError])

	return (
		<canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				if (!map.current) return
				if (event.buttons === 1) map.current.pan(event.movementX * devicePixelRatio, event.movementY * devicePixelRatio)
			}}
			onWheel={(event) => {
				if (!map.current) return
				map.current.setZoom(map.current.zoom - event.deltaY / 100)
			}}
		/>
	)
}

export const Map = memo(MapImpl)
