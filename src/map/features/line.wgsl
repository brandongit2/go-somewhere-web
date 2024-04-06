@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;

struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) fUv: vec2f,
}

@vertex fn vs(@location(0) vertex: vec3f, @location(1) uv: vec2f) -> VertexOutput {
	var output: VertexOutput;
	output.position = projectionMatrix * viewMatrix * vec4f(vertex, 1.0);
	output.fUv = uv;
	return output;
}

@group(0) @binding(2) var<uniform> color: vec3f;

@fragment fn fs(@location(0) fUv: vec2f) -> @location(0) vec4f {
	if (length(fUv) > 1.0) {
		discard;
	}

	return vec4f(color, 1.0);
}
