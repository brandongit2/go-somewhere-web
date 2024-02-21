import earcut, {flatten} from "earcut"

import type {WebgpuContext} from "./context"
import type {MapTileLayer} from "./types"

import {linestringToMesh} from "./linestring-to-mesh"
import polygonShaders from "./polygon-shaders.wgsl"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export class MapLayer {
	shaderModule: GPUShaderModule
	renderPipeline: GPURenderPipeline

	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer

	constructor(
		public layer: MapTileLayer,
		public color: [number, number, number],
		{device, presentationFormat, pipelineLayout}: WebgpuContext,
	) {
		const geometries = layer.features
			.map((feature) => feature.geoJson.geometry)
			.flatMap((geometry) => {
				if (geometry.type === `GeometryCollection`) return geometry.geometries
				else return [geometry]
			})

		const meshes = geometries.flatMap((geometry) => {
			switch (geometry.type) {
				case `LineString`: {
					return [linestringToMesh(geometry.coordinates.flat(), 0.01)]
				}
				case `MultiLineString`: {
					return geometry.coordinates.map((coords) => linestringToMesh(coords.flat(), 0.01))
				}
				case `Polygon`: {
					const data = flatten(geometry.coordinates)
					const indices = earcut(data.vertices, data.holes, data.dimensions)
					const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

					return [{vertices, indices}]
				}
				case `MultiPolygon`: {
					return geometry.coordinates.map((coords) => {
						const data = flatten(coords)
						const indices = earcut(data.vertices, data.holes, data.dimensions)
						const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

						return {vertices, indices}
					})
				}
				default: {
					return []
				}
			}
		})

		let singleMesh = {vertices: [] as number[], indices: [] as number[]}
		for (const mesh of meshes) {
			singleMesh.indices.push(...mesh.indices.map((index) => index + singleMesh.vertices.length / 3))
			singleMesh.vertices.push(...mesh.vertices)
		}

		this.vertexBuffer = device.createBuffer({
			label: `vertex buffer`,
			size: singleMesh.vertices.length * 4,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(singleMesh.vertices))
		this.indexBuffer = device.createBuffer({
			label: `index buffer`,
			size: singleMesh.indices.length * 4,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(singleMesh.indices))

		this.shaderModule = device.createShaderModule({
			label: `shaders`,
			code: polygonShaders,
		})
		this.renderPipeline = device.createRenderPipeline({
			label: `pipeline`,
			layout: pipelineLayout,
			vertex: {
				entryPoint: `vs`,
				module: this.shaderModule,
				buffers: [
					{
						arrayStride: 3 * 4,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3` as const}],
					},
				],
			},
			fragment: {
				entryPoint: `fs`,
				module: this.shaderModule,
				targets: [{format: presentationFormat}],
			},
		})
	}

	draw(encoder: GPURenderPassEncoder, {device, colorUniformBuffer}: WebgpuContext) {
		encoder.setPipeline(this.renderPipeline)
		device.queue.writeBuffer(colorUniformBuffer, 0, new Float32Array(this.color))

		encoder.setVertexBuffer(0, this.vertexBuffer)
		encoder.setIndexBuffer(this.indexBuffer, `uint32`)
		encoder.drawIndexed(this.indexBuffer.size / 4)
	}
}
