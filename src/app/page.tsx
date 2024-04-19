import {lazy} from "react"

const MapRoot = lazy(() => import(`@/map/MapRoot`).then(({MapRoot}) => ({default: MapRoot})))

export default function RootPage() {
	return (
		<div className="absolute left-0 top-0 h-full w-full">
			<MapRoot />
		</div>
	)
}
