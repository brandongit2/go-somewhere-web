// Currently just `SurfaceLine` but with world coordinates instead of lng/lat
// Potential improvements:
// - Get line thickness from camera position (currently it's just the same logic from `SurfaceLine` which doesn't make
//   sense here)
// - Line faces don't face the camera right now. Not sure why.

import {type Feature} from "./Feature"
import shader from "./surface-line.wgsl"
import {FOUR_BYTES_PER_FLOAT, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {linestringToMesh} from "@/linestring-to-mesh"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d, type WorldCoord} from "@/types"
import {lngLatToWorld} from "@/util"

type LineArgs = {
	lines: WorldCoord[][]
	thickness: number
	color: Coord3d
}

export class Line implements Feature {
	thickness: number
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer
	normalBuffer: GPUBuffer
	miterLengthBuffer: GPUBuffer
	thicknessBuffer: GPUBuffer
	colorBuffer: GPUBuffer
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline

	constructor(
		private mapContext: MapContext,
		args: LineArgs,
	) {
		const {device, viewMatrixBuffer} = mapContext

		this.thicknessBuffer = device.createBuffer({
			label: `surface line thickness buffer`,
			size: FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this.colorBuffer = device.createBuffer({
			label: `surface line colour buffer`,
			size: 3 * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.thickness = null!
		this.vertexBuffer = null!
		this.indexBuffer = null!
		this.normalBuffer = null!
		this.miterLengthBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `surface line bind group layout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: `uniform`},
				},
			],
		})

		const pipelineLayout = device.createPipelineLayout({
			label: `surface polygon pipeline layout`,
			bindGroupLayouts: [bindGroupLayout],
		})

		const bindGroup = device.createBindGroup({
			label: `surface line bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: viewMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.thicknessBuffer},
				},
				{
					binding: 2,
					resource: {buffer: this.colorBuffer},
				},
			],
		})

		const renderPipeline = device.createRenderPipeline({
			label: `surface line render pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: device.createShaderModule({
					label: `surface line vertex shader`,
					code: shader,
				}),
				entryPoint: `vs`,
				buffers: [
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 1, offset: 0, format: `float32x3`}],
					},
					{
						arrayStride: FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 2, offset: 0, format: `float32`}],
					},
				],
			},
			fragment: {
				module: device.createShaderModule({
					label: `surface line fragment shader`,
					code: shader,
				}),
				entryPoint: `fs`,
				targets: [{format: mapContext.presentationFormat}],
			},
			primitive: {
				cullMode: `back`,
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
		const {device, degreesPerPx} = this.mapContext

		device.queue.writeBuffer(this.thicknessBuffer, 0, new Float32Array([this.thickness * degreesPerPx]))

		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setVertexBuffer(1, this.normalBuffer)
		pass.setVertexBuffer(2, this.miterLengthBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / 4)
	}

	set = (args: LineArgs) => {
		this.thickness = args.thickness
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()
		;(this.normalBuffer as typeof this.normalBuffer | undefined)?.destroy()
		;(this.miterLengthBuffer as typeof this.miterLengthBuffer | undefined)?.destroy()

		const mesh = args.lines
			.map((coords) => linestringToMesh(coords, lngLatToWorld(this.mapContext.cameraPos)))
			.reduce(
				(acc, cur) => {
					acc.indices.push(...cur.indices.map((i) => i + acc.vertices.length))
					acc.vertices.push(...cur.vertices)
					acc.normals.push(...cur.normals)
					acc.miterLengths.push(...cur.miterLengths)
					return acc
				},
				{
					vertices: [] as WorldCoord[],
					normals: [] as Coord3d[],
					miterLengths: [] as number[],
					indices: [] as number[],
				},
			)

		const {device} = this.mapContext

		device.queue.writeBuffer(this.thicknessBuffer, 0, new Float32Array([this.thickness]))
		device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(args.color))

		this.vertexBuffer = device.createBuffer({
			label: `surface line vertex buffer`,
			size: mesh.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(mesh.vertices.flatMap((v) => v)))

		this.indexBuffer = device.createBuffer({
			label: `surface line index buffer`,
			size: mesh.indices.length * FOUR_BYTES_PER_INT32,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(mesh.indices))

		this.normalBuffer = device.createBuffer({
			size: mesh.normals.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.normalBuffer, 0, new Float32Array(mesh.normals.flatMap((n) => n)))

		this.miterLengthBuffer = device.createBuffer({
			size: mesh.miterLengths.length * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.miterLengthBuffer, 0, new Float32Array(mesh.miterLengths))
	}
}
