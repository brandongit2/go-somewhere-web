import {type Promisable} from "type-fest"

import {linestringsToMesh, type LinestringsToMeshArgs, type LinestringsToMeshReturn} from "./linestrings-to-mesh"
import {fetchTile, type FetchTileArgs, type FetchTileReturn} from "@/workers/fetch-tile"

export type WorkerActions = {
	fetchTile: {
		args: FetchTileArgs
		return: FetchTileReturn
	}
	linestringsToMesh: {
		args: LinestringsToMeshArgs
		return: LinestringsToMeshReturn
	}
}
export type ActionNames = keyof WorkerActions
const workerActors: {
	[K in ActionNames]: (args: WorkerActions[K]["args"], abortController: AbortController) => Promisable<void>
} = {
	fetchTile,
	linestringsToMesh,
}

onmessage = <ActionName extends ActionNames>(
	event: MessageEvent<{action: ActionName; args: WorkerActions[ActionName]["args"]} | `abort`>,
) => {
	const controller = new AbortController()
	if (event.data === `abort`) {
		controller.abort()
		return
	}

	const {action, args} = event.data
	Promise.resolve(workerActors[action](args, controller)).catch((err) => {
		throw err
	})
}
