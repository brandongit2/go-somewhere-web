@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;

@vertex fn vs(@location(0) vertex: vec3f) -> @builtin(position) vec4f {
	return projectionMatrix * viewMatrix * vec4f(vertex, 1.0);
}

@group(0) @binding(2) var<uniform> color: vec3f;

@fragment fn fs() -> @location(0) vec4f {
	return vec4f(color, 1.0);
}
