"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface GeolocationState {
	position: GeolocationPosition | null
	error: GeolocationPositionError | null
	isLoading: boolean
	clearWatch: () => void
}

/**
 * Subscribes to `navigator.geolocation` with both an initial `getCurrentPosition`
 * call and an ongoing `watchPosition` subscription. Callers should set
 * `enabled=false` until the user is ready to grant the prompt — otherwise
 * Chrome shows the permission dialog as soon as the component mounts.
 */
export function useGeolocation(options?: PositionOptions, enabled = true): GeolocationState {
	const [position, setPosition] = useState<GeolocationPosition | null>(null)
	const [error, setError] = useState<GeolocationPositionError | null>(null)

	const watchId = useRef<number | null>(null)

	const clearWatch = useCallback(() => {
		if (watchId.current !== null && "geolocation" in navigator) {
			navigator.geolocation.clearWatch(watchId.current)
			watchId.current = null
		}
	}, [])

	useEffect(() => {
		if (!enabled) {
			clearWatch()
			return
		}

		if (!("geolocation" in navigator)) {
			// Deferred so the state update happens outside the effect body itself
			// (satisfies react-hooks/set-state-in-effect for this one-time error).
			queueMicrotask(() => {
				setError({
					code: 0,
					message: "Geolocation API not supported",
				} as GeolocationPositionError)
			})
			return
		}

		const onSuccess = (pos: GeolocationPosition) => {
			setPosition(pos)
			setError(null)
		}

		const onError = (err: GeolocationPositionError) => {
			setError(err)
			setPosition(null)
		}

		navigator.geolocation.getCurrentPosition(onSuccess, onError, options)

		const id = navigator.geolocation.watchPosition(onSuccess, onError, options)
		watchId.current = id

		return () => {
			clearWatch()
		}
	}, [options, enabled, clearWatch])

	// Derive isLoading from the underlying data so we never need to setState
	// synchronously inside the effect just to track the loading flag.
	const isLoading = enabled && position === null && error === null

	return { position, error, isLoading, clearWatch }
}
