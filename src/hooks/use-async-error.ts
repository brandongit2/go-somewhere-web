import {useCallback, useState} from "react"

// https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
export const useAsyncError = () => {
	const [, setError] = useState()
	return useCallback(
		(e: unknown) => {
			setError(() => {
				throw e
			})
		},
		[setError],
	)
}
