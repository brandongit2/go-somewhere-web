import type Pbf from "pbf"

type TTile = {
	layers?: TLayer[]
}

type TLayer = {
	version: number
	name: string
	features?: TFeature[]
	keys?: string[]
	values?: TValue[]
	extent: number
}

type TFeature = {
	id?: number
	tags?: number[]
	type?: number
	geometry?: number[]
}

type TValueAll = {
	string_value?: never
	float_value?: never
	double_value?: never
	int_value?: never
	uint_value?: never
	sint_value?: never
	bool_value?: never
}

type TValue =
	| (Omit<TValueAll, "string_value"> & {string_value: string})
	| (Omit<TValueAll, "float_value"> & {float_value: number})
	| (Omit<TValueAll, "double_value"> & {double_value: number})
	| (Omit<TValueAll, "int_value"> & {int_value: number})
	| (Omit<TValueAll, "uint_value"> & {uint_value: number})
	| (Omit<TValueAll, "sint_value"> & {sint_value: number})
	| (Omit<TValueAll, "bool_value"> & {bool_value: boolean})

export const Tile = {
	read: (pbf: Pbf, end?: number) => pbf.readFields(Tile._readField, {layers: []} as TTile, end),
	_readField: (tag: number, obj: TTile, pbf: Pbf) => {
		if (tag === 3) {
			if (!obj.layers) obj.layers = []
			obj.layers.push(Tile.Layer.read(pbf, pbf.readVarint() + pbf.pos))
		}
	},
	write: (obj: TTile, pbf: Pbf) => {
		if (obj.layers) for (const layer of obj.layers) pbf.writeMessage(3, Tile.Layer.write, layer)
	},
	GeomType: {
		UNKNOWN: {
			value: 0,
			options: {},
		},
		POINT: {
			value: 1,
			options: {},
		},
		LINESTRING: {
			value: 2,
			options: {},
		},
		POLYGON: {
			value: 3,
			options: {},
		},
	},
	Value: {
		read: (pbf: Pbf, end?: number) => pbf.readFields(Tile.Value._readField, {} as TValue, end),
		_readField: (tag: number, obj: TValue, pbf: Pbf) => {
			if (tag === 1) obj.string_value = pbf.readString()
			else if (tag === 2) obj.float_value = pbf.readFloat()
			else if (tag === 3) obj.double_value = pbf.readDouble()
			else if (tag === 4) obj.int_value = pbf.readVarint(true)
			else if (tag === 5) obj.uint_value = pbf.readVarint()
			else if (tag === 6) obj.sint_value = pbf.readSVarint()
			else if (tag === 7) obj.bool_value = pbf.readBoolean()
		},
		write: (obj: TValue, pbf: Pbf) => {
			if (obj.string_value) pbf.writeStringField(1, obj.string_value)
			if (obj.float_value) pbf.writeFloatField(2, obj.float_value)
			if (obj.double_value) pbf.writeDoubleField(3, obj.double_value)
			if (obj.int_value) pbf.writeVarintField(4, obj.int_value)
			if (obj.uint_value) pbf.writeVarintField(5, obj.uint_value)
			if (obj.sint_value) pbf.writeSVarintField(6, obj.sint_value)
			if (obj.bool_value) pbf.writeBooleanField(7, obj.bool_value)
		},
	},
	Feature: {
		read: (pbf: Pbf, end?: number) =>
			pbf.readFields(Tile.Feature._readField, {id: 0, tags: [], type: 0, geometry: []} as TFeature, end),
		_readField: (tag: number, obj: TFeature, pbf: Pbf) => {
			if (tag === 1) obj.id = pbf.readVarint()
			else if (tag === 2) pbf.readPackedVarint(obj.tags)
			else if (tag === 3) obj.type = pbf.readVarint()
			else if (tag === 4) pbf.readPackedVarint(obj.geometry)
		},
		write: (obj: TFeature, pbf: Pbf) => {
			if (obj.id) pbf.writeVarintField(1, obj.id)
			if (obj.tags) pbf.writePackedVarint(2, obj.tags)
			if (obj.type) pbf.writeVarintField(3, obj.type)
			if (obj.geometry) pbf.writePackedVarint(4, obj.geometry)
		},
	},
	Layer: {
		read: (pbf: Pbf, end?: number) =>
			pbf.readFields(
				Tile.Layer._readField,
				{version: 0, name: ``, features: [], keys: [], values: [], extent: 0} as TLayer,
				end,
			),
		_readField: (tag: number, obj: TLayer, pbf: Pbf) => {
			if (tag === 15) obj.version = pbf.readVarint()
			else if (tag === 1) obj.name = pbf.readString()
			else if (tag === 2) {
				if (!obj.features) obj.features = []
				obj.features.push(Tile.Feature.read(pbf, pbf.readVarint() + pbf.pos))
			} else if (tag === 3) {
				if (!obj.keys) obj.keys = []
				obj.keys.push(pbf.readString())
			} else if (tag === 4) {
				if (!obj.values) obj.values = []
				obj.values.push(Tile.Value.read(pbf, pbf.readVarint() + pbf.pos))
			} else if (tag === 5) obj.extent = pbf.readVarint()
		},
		write: (obj: TLayer, pbf: Pbf) => {
			if (obj.version) pbf.writeVarintField(15, obj.version)
			if (obj.name) pbf.writeStringField(1, obj.name)
			if (obj.features) for (const feature of obj.features) pbf.writeMessage(2, Tile.Feature.write, feature)
			if (obj.keys) for (const key of obj.keys) pbf.writeStringField(3, key)
			if (obj.values) for (const value of obj.values) pbf.writeMessage(4, Tile.Value.write, value)
			if (obj.extent) pbf.writeVarintField(5, obj.extent)
		},
	},
}
