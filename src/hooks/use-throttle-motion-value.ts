import {useMotionValueEvent, type MotionValue} from "framer-motion"
import {useRef, useState} from "react"

export const useThrottleMotionValue = <T>(value: MotionValue<T>, timeout = 200) => {
	const [throttledValue, setThrottledValue] = useState(value.get())
	const timeoutId = useRef<NodeJS.Timeout | null>(null)

	useMotionValueEvent(value, `change`, (latest) => {
		if (timeoutId.current) {
			clearTimeout(timeoutId.current)
		}

		timeoutId.current = setTimeout(() => {
			setThrottledValue(latest)
			timeoutId.current = null
		}, timeout)
	})

	return throttledValue
}
