export const gpu = navigator.gpu

export const gpuAdapter = await (async () => {
	const gpuAdatper = await gpu.requestAdapter()
	if (!gpuAdatper) throw new Error(`No suitable GPUs found.`)
	return gpuAdatper
})()

export const device = await gpuAdapter.requestDevice({label: `GPU device`})
device.lost
	.then((info) => {
		if (info.reason !== `destroyed`) throw new Error(`GPU lost. Info: ${info.message}`)
	})
	.catch((error) => {
		throw error
	})

export const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
