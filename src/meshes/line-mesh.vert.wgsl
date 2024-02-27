@group(0) @binding(0) var<uniform> viewMatrix: mat4x4f;
@group(0) @binding(1) var<uniform> thickness:  f32;

@vertex fn main(
	@location(0) vertex:      vec2f,
	@location(1) normal:      vec2f,
	@location(2) miterLength: f32,
) -> @builtin(position) vec4f {
	let extruded = vertex + normal * miterLength * thickness;

	let cosLat = cos(extruded.y * 3.14159 / 2.0);
	let sinLat = sin(extruded.y * 3.14159 / 2.0);
	let sinLng = sin(extruded.x * 3.14159 / 2.0);
	let onSphere = vec3f(cosLat, sinLng, sinLat);

	return viewMatrix * vec4f(onSphere, 1.0);
}
