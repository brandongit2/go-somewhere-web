import {linestringsToMesh, type LinestringsToMeshArgs, type LinestringsToMeshReturn} from "./linestrings-to-mesh"

export type WorkerActions = {
	linestringsToMesh: {
		args: LinestringsToMeshArgs
		return: LinestringsToMeshReturn
	}
}
export type ActionNames = keyof WorkerActions
const workerActors = {
	linestringsToMesh,
} satisfies {[K in ActionNames]: (args: WorkerActions[K]["args"]) => void}

onmessage = <ActionName extends ActionNames>(
	event: MessageEvent<{action: ActionName; args: WorkerActions[ActionName]["args"]}>,
) => {
	const {action, args} = event.data
	workerActors[action](args)
}
