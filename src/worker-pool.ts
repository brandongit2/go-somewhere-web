import {type ActionNames, type WorkerActions} from "./workers/reducer"

type Task<ActionName extends ActionNames> = {
	action: ActionName
	args: WorkerActions[ActionName]["args"]
	options?: StructuredSerializeOptions
	resolve: (data: WorkerActions[ActionName]["return"]) => void
}
const taskQueue: Array<Task<ActionNames>> = []

class PoolWorker {
	worker = new Worker(new URL(`./workers/reducer.ts`, import.meta.url), {type: `module`})
	busy = false

	findTask = () => {
		this.busy = true

		const task = taskQueue.shift()
		if (!task) {
			this.busy = false
			return
		}

		this.worker.onmessage = (event: MessageEvent<WorkerActions[typeof task.action]["return"]>) => {
			task.resolve(event.data)
			this.busy = false

			this.findTask()
		}
		this.worker.postMessage({action: task.action, args: task.args}, task.options)
	}
}

const workers = typeof window === `undefined` ? [] : Array.from({length: 6}, () => new PoolWorker())

export const dispatchToWorker = async <ActionName extends ActionNames>(
	action: ActionName,
	args: WorkerActions[ActionName]["args"],
	options?: StructuredSerializeOptions,
) =>
	new Promise<WorkerActions[ActionName]["return"]>((resolve) => {
		taskQueue.push({action, args, options, resolve})
		const worker = workers.find((worker) => !worker.busy)
		if (worker) worker.findTask()
	})
