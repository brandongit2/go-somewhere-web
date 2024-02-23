@group(0) @binding(0) var<uniform> viewMatrix: mat4x4f;
@group(0) @binding(1) var<uniform> thickness:  f32;

@vertex fn main(
	@location(0) vertex:      vec3f,
	@location(1) normal:      vec3f,
	@location(2) miterLength: f32,
) -> @builtin(position) vec4f {
	let extruded = vertex + normal * miterLength * thickness;
	return viewMatrix * vec4f(extruded, 1.0);
}
