import earcut, {flatten} from "earcut"

import type {WebgpuContext} from "./context"
import type {MapTileLayer} from "./types"

import polygonShaders from "./polygon-shaders.wgsl"
import {vec2ArrayToVec3Array} from "@/util"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export class MapLayer {
	shaderModule: GPUShaderModule
	renderPipeline: GPURenderPipeline

	meshes: Array<{
		vertices: number[]
		indices: number[]
	}>

	constructor(
		public layer: MapTileLayer,
		public color: string,
		{device, presentationFormat, pipelineLayout}: WebgpuContext,
	) {
		const geometries = layer.features
			.map((feature) => feature.geoJson.geometry)
			.flatMap((geometry) => {
				if (geometry.type === `GeometryCollection`) return geometry.geometries
				else return [geometry]
			})

		this.meshes = geometries.flatMap((geometry) => {
			switch (geometry.type) {
				case `LineString`: {
					return [
						{
							vertices: vec2ArrayToVec3Array(geometry.coordinates.flat()),
							indices: new Array(geometry.coordinates.length).fill(0).map((_, i) => i),
						},
					]
				}
				case `MultiLineString`: {
					return geometry.coordinates.map((coords) => ({
						vertices: vec2ArrayToVec3Array(coords.flat()),
						indices: new Array(coords.length).fill(0).map((_, i) => i),
					}))
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

	draw(encoder: GPURenderPassEncoder, {device}: WebgpuContext) {
		encoder.setPipeline(this.renderPipeline)

		let singleMesh = {vertices: [] as number[], indices: [] as number[]}
		for (const mesh of this.meshes) {
			singleMesh.indices.push(...mesh.indices.map((index) => index + singleMesh.vertices.length / 3))
			singleMesh.vertices.push(...mesh.vertices)
		}

		const vertexBuffer = device.createBuffer({
			label: `vertex buffer`,
			size: singleMesh.vertices.length * 4,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(singleMesh.vertices))
		encoder.setVertexBuffer(0, vertexBuffer)

		const indexBuffer = device.createBuffer({
			label: `index buffer`,
			size: singleMesh.indices.length * 4,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(indexBuffer, 0, new Uint32Array(singleMesh.indices))
		encoder.setIndexBuffer(indexBuffer, `uint32`)

		encoder.drawIndexed(singleMesh.indices.length)
	}
}
