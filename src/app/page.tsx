import {Map} from "./Map"

export default function RootPage() {
	return (
		<div className="absolute left-0 top-0 h-full w-full">
			<Map />
			<div className="absolute left-1/2 top-1/2 z-10 h-0.5 w-[256px] -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-yellow-300 opacity-50" />
		</div>
	)
}
