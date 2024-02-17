import {useMotionValueEvent, type MotionValue} from "framer-motion"
import {useRef, useState} from "react"

export const useThrottleMotionValue = <T>(value: MotionValue<T>, timeout = 200) => {
	const [throttledValue, setThrottledValue] = useState(value.get())
	const lastUpdated = useRef(0)
	useMotionValueEvent(value, `change`, (latest) => {
		if (Date.now() - lastUpdated.current > timeout) {
			lastUpdated.current = Date.now()
			setThrottledValue(latest)
		}
	})
	return throttledValue
}
