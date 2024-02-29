@group(0) @binding(0) var<uniform> viewMatrix:  mat4x4f;
@group(0) @binding(1) var<uniform> modelMatrix: mat4x4f;

@vertex fn main(@location(0) vertex: vec3f) -> @builtin(position) vec4f {
	return viewMatrix * modelMatrix * vec4f(vertex, 1.0);
}
