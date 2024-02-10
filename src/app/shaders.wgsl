struct Variant {
	color:  vec4f,
	scale:  vec2f,
	offset: vec2f,
};

@group(0) @binding(0) var<storage> variants: array<Variant>;
@group(0) @binding(1) var<storage> pos:      array<vec2f>;

struct VsOutput {
	@builtin(position) position: vec4f,
	@location(0)       color:    vec4f,
};

@vertex fn vs(
	@builtin(vertex_index)   vertexIndex:   u32,
	@builtin(instance_index) instanceIndex: u32,
) -> VsOutput {
	let variant = variants[instanceIndex];
	var output = VsOutput(
		vec4f(pos[vertexIndex] * variant.scale + variant.offset, 0.0, 1.0),
		variant.color,
	);
	return output;
}

@fragment fn fs(vsOutput: VsOutput) -> @location(0) vec4f {
	return vsOutput.color;
}
