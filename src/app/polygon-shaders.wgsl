@group(0) @binding(0) var<uniform> viewMatrix: mat4x4f;

@vertex fn vs(@location(0) vertex: vec3f) -> @builtin(position) vec4f {
	return viewMatrix * vec4f(vertex, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
	return vec4f(0.0, 0.0, 1.0, 1.0);
}
