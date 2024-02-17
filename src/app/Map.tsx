"use client"

import {OrthographicCamera} from "@react-three/drei"
import {Canvas, extend, type BufferGeometryNode, type MaterialNode} from "@react-three/fiber"
import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {MeshLineGeometry, MeshLineMaterial} from "meshline"
import {useEffect, useRef, useState} from "react"

import type {OrthographicCamera as ThreeOrthographicCamera} from "three"

import {MapTile} from "./MapTile"
import {useThrottleMotionValue} from "@/hooks/use-throttle-motion-value"
import {clamp, lat2tile, lng2tile} from "@/util"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want

extend({MeshLineGeometry, MeshLineMaterial})

const pxPerTile = 512

export const Map = () => {
	const [screenWidth, setScreenWidth] = useState(1000)
	const [screenHeight, setScreenHeight] = useState(1000)
	useEffect(() => {
		const handleResize = () => {
			setScreenWidth(window.innerWidth)
			setScreenHeight(window.innerHeight)
		}
		handleResize()

		window.addEventListener(`resize`, handleResize)
		return () => window.removeEventListener(`resize`, handleResize)
	}, [])

	// const screenToClipMatrix = new Matrix3().set(2 / screenWidth, 0, -1, 0, -2 / screenHeight, 1, 0, 0, 1)

	const _lng = useMotionValue(0)
	const _lat = useMotionValue(0)
	const _zoom = useMotionValue(0)

	const lat = useThrottleMotionValue(_lat)
	const lng = useThrottleMotionValue(_lng)
	const zoom = useThrottleMotionValue(_zoom)
	const _degreesPerPx = useTransform(() => 360 / pxPerTile / 2 ** _zoom.get())
	const zoomRounded = Math.floor(zoom)

	const leftTile = Math.floor(lng2tile(clamp(lng - (screenWidth / 2) * _degreesPerPx.get(), -180, 180), zoomRounded))
	const rightTile = Math.ceil(lng2tile(clamp(lng + (screenWidth / 2) * _degreesPerPx.get(), -180, 180), zoomRounded))
	const topTile = Math.floor(lat2tile(clamp(lat + (screenHeight / 2) * _degreesPerPx.get(), -85, 85), zoomRounded))
	const bottomTile = Math.ceil(lat2tile(clamp(lat - (screenHeight / 2) * _degreesPerPx.get(), -85, 85), zoomRounded))
	let tilesInView: Array<[number, number]> = []
	for (let x = clamp(leftTile, 0, 2 ** zoomRounded); x < clamp(rightTile, 0, 2 ** zoomRounded); x++) {
		for (let y = clamp(topTile, 0, 2 ** zoomRounded); y < clamp(bottomTile, 0, 2 ** zoomRounded); y++) {
			tilesInView.push([x, y])
		}
	}

	const cameraRef = useRef<ThreeOrthographicCamera>(null)
	useAnimationFrame(() => {
		if (!cameraRef.current) return

		cameraRef.current.left = _lng.get() - _degreesPerPx.get() * (screenWidth / 2)
		cameraRef.current.right = _lng.get() + _degreesPerPx.get() * (screenWidth / 2)
		cameraRef.current.top = _lat.get() + _degreesPerPx.get() * (screenHeight / 2)
		cameraRef.current.bottom = _lat.get() - _degreesPerPx.get() * (screenHeight / 2)
		cameraRef.current.updateProjectionMatrix()
	})

	return (
		<motion.div
			className="h-full w-full"
			onPan={(event, info) => {
				_lng.set(clamp(_lng.get() - info.delta.x * _degreesPerPx.get(), -180, 180))
				_lat.set(clamp(_lat.get() + info.delta.y * _degreesPerPx.get(), -85, 85))
			}}
			onWheel={(event) => {
				_zoom.set(clamp(_zoom.get() - event.deltaY * 0.01, 0, 18))
			}}
		>
			<Canvas>
				{tilesInView.map(([x, y]) => (
					<MapTile key={`${x}.${y}`} x={x} y={y} zoom={zoomRounded} />
				))}

				<OrthographicCamera
					makeDefault
					manual
					ref={cameraRef}
					left={-100}
					right={100}
					top={100}
					bottom={-100}
					position={[0, 0, 5]}
				/>
			</Canvas>
		</motion.div>
	)
}

declare module "@react-three/fiber" {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface ThreeElements {
		meshLineGeometry: BufferGeometryNode<MeshLineGeometry, typeof MeshLineGeometry>
		meshLineMaterial: MaterialNode<MeshLineMaterial, typeof MeshLineMaterial>
	}
}
