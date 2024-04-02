import {type Feature} from "./Feature"
import shader from "./line.wgsl"
import {
	FOUR_BYTES_PER_FLOAT32,
	FOUR_BYTES_PER_INT32,
	THREE_NUMBERS_PER_3D_COORD,
	TWO_BYTES_PER_FLOAT16,
	TWO_NUMBERS_PER_2D_COORD,
} from "@/const"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d, type WorldCoord} from "@/types"
import {dispatchToWorker} from "@/worker-pool"
import {type LinestringsToMeshArgs} from "@/workers/linestrings-to-mesh"

type LineArgs = {
	lines: WorldCoord[][]
	thickness: number
	viewPoint: WorldCoord
	color: Coord3d
}

export class Line implements Feature {
	private linestringsBuffer = new SharedArrayBuffer(0, {maxByteLength: 1.2e6})
	private linestringsBufferSize = 0
	private numVertices: number | undefined
	private thickness: number | undefined
	private viewPoint: WorldCoord | undefined

	indexBuffer: GPUBuffer | undefined
	indicesSize: number | undefined
	vertexBuffer: GPUBuffer | undefined
	uvBuffer: GPUBuffer | undefined
	colorBuffer: GPUBuffer
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline

	constructor(
		private mapContext: MapContext,
		args: LineArgs,
	) {
		const {device, viewMatrixBuffer} = mapContext

		this.colorBuffer = device.createBuffer({
			label: `line colour buffer`,
			size: 3 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.set(args).catch((err) => {
			throw err
		})

		const bindGroupLayout = device.createBindGroupLayout({
			label: `line bind group layout`,
			entries: [
				{
					// `viewMatrix`
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					// `color`
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: `uniform`},
				},
			],
		})

		const pipelineLayout = device.createPipelineLayout({
			label: `line pipeline layout`,
			bindGroupLayouts: [bindGroupLayout],
		})

		const bindGroup = device.createBindGroup({
			label: `line bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: viewMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.colorBuffer},
				},
			],
		})

		const renderPipeline = device.createRenderPipeline({
			label: `line render pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: device.createShaderModule({
					label: `line vertex shader`,
					code: shader,
				}),
				entryPoint: `vs`,
				buffers: [
					{
						// `vertex`
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT32,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
					{
						// `uv`
						arrayStride: TWO_NUMBERS_PER_2D_COORD * TWO_BYTES_PER_FLOAT16,
						attributes: [{shaderLocation: 1, offset: 0, format: `float16x2`}],
					},
				],
			},
			fragment: {
				module: device.createShaderModule({
					label: `line fragment shader`,
					code: shader,
				}),
				entryPoint: `fs`,
				targets: [{format: mapContext.presentationFormat}],
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: `greater`,
				format: `depth24plus`,
			},
		})

		this.bindGroup = bindGroup
		this.renderPipeline = renderPipeline
	}

	draw = (pass: GPURenderPassEncoder) => {
		if (!this.indexBuffer || !this.vertexBuffer || !this.uvBuffer || !this.indicesSize) return

		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)

		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setVertexBuffer(1, this.uvBuffer)
		pass.drawIndexed(this.indicesSize / FOUR_BYTES_PER_INT32)
	}

	set = async (args: LineArgs) => {
		this.setColor(args.color)
		this.setGeomImpl(args.lines)
		this.setThicknessImpl(args.thickness)
		this.setViewPointImpl(args.viewPoint)
		await this.calculateMesh()
	}

	setColor = (color: Coord3d) => {
		this.mapContext.device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(color))
	}

	private setGeomImpl = (lines: WorldCoord[][]) => {
		this.numVertices = 0
		const linesFlattened = lines.flatMap((line) => {
			this.numVertices! += line.length
			return [line.length, ...line.flat()]
		})
		if (linesFlattened.length * 4 > this.linestringsBuffer.byteLength)
			this.linestringsBuffer.grow(linesFlattened.length * FOUR_BYTES_PER_FLOAT32)
		const view = new Float32Array(this.linestringsBuffer)
		view.set(linesFlattened)
		this.linestringsBufferSize = linesFlattened.length * FOUR_BYTES_PER_FLOAT32
	}
	setGeom = async (lines: WorldCoord[][]) => {
		this.setGeomImpl(lines)
		await this.calculateMesh()
	}

	private setThicknessImpl = (thickness: number) => {
		this.thickness = thickness
	}
	setThickness = async (thickness: number) => {
		this.setThicknessImpl(thickness)
		await this.calculateMesh()
	}

	private setViewPointImpl = (viewPoint: WorldCoord) => {
		this.viewPoint = viewPoint
	}
	setViewPoint = async (viewPoint: WorldCoord) => {
		this.setViewPointImpl(viewPoint)
		await this.calculateMesh()
	}

	private calculateMesh = async () => {
		if (!this.numVertices || !this.thickness || !this.viewPoint) return

		const oldIndexBuffer = this.indexBuffer
		const oldVertexBuffer = this.vertexBuffer
		const oldUvBuffer = this.uvBuffer

		const workerArgs: LinestringsToMeshArgs = {
			linestringsBuffer: this.linestringsBuffer,
			linestringsBufferSize: this.linestringsBufferSize,
			numVertices: this.numVertices,
			viewPoint: this.viewPoint,
			thickness: this.thickness,
		}
		const {buffer, indicesSize, verticesSize, uvsSize} = await dispatchToWorker(`linestringsToMesh`, workerArgs)
		this.indicesSize = indicesSize
		const indices = new Uint32Array(buffer, 0, indicesSize / FOUR_BYTES_PER_INT32)
		const vertices = new Float32Array(buffer, indicesSize, verticesSize / FOUR_BYTES_PER_FLOAT32)
		// I would construct this with `Float16Array` but since it's a polyfill it does weird things. I use `Int16Array` instead; I hope it's fine.
		const uvs = new Int16Array(buffer, indicesSize + verticesSize, uvsSize / TWO_BYTES_PER_FLOAT16)

		const {device} = this.mapContext

		if (!this.indexBuffer || this.indexBuffer.size < indicesSize) {
			this.indexBuffer = device.createBuffer({
				label: `line index buffer`,
				size: indicesSize,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})

			oldIndexBuffer?.destroy()
		}
		device.queue.writeBuffer(this.indexBuffer, 0, indices)

		if (!this.vertexBuffer || this.vertexBuffer.size < verticesSize) {
			this.vertexBuffer = device.createBuffer({
				label: `line vertex buffer`,
				size: verticesSize,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})

			oldVertexBuffer?.destroy()
		}
		device.queue.writeBuffer(this.vertexBuffer, 0, vertices)

		if (!this.uvBuffer || this.uvBuffer.size < uvsSize) {
			this.uvBuffer = device.createBuffer({
				label: `line uv buffer`,
				size: uvsSize,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})

			oldUvBuffer?.destroy()
		}
		device.queue.writeBuffer(this.uvBuffer, 0, uvs)
	}
}
