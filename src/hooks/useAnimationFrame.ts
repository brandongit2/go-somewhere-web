import {useEffect, useRef} from "react"
import {type Promisable} from "type-fest"

export const useAnimationFrame = (callback: (delta: number, nextFrame: () => void) => Promisable<void>) => {
	const requestRef = useRef<number | null>(null)
	const previousTimeRef = useRef<number | null>(null)

	useEffect(() => {
		const animate = (time: number) => {
			if (previousTimeRef.current === null) return

			const deltaTime = time - previousTimeRef.current
			previousTimeRef.current = time

			Promise.resolve(
				callback(deltaTime, () => {
					requestRef.current = requestAnimationFrame(animate)
				}),
			).catch((error) => {
				throw error
			})
		}

		requestRef.current = requestAnimationFrame(animate)
		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current)
		}
	}, [callback])
}
