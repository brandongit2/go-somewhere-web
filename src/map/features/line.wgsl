@group(0) @binding(0) var<uniform> viewMatrix: mat4x4f;
@group(0) @binding(1) var<uniform> thickness: f32;

@vertex fn vs(
	@location(0) vertex: vec3f,
	@location(1) normal: vec3f,
	@location(2) miterLength: f32,
) -> @builtin(position) vec4f {
	let extruded = vertex + normal * miterLength * thickness;
	return viewMatrix * vec4f(extruded, 1.0);
}

@group(0) @binding(2) var<uniform> color: vec3f;

@fragment fn fs() -> @location(0) vec4f {
	return vec4f(color, 1.0);
}
