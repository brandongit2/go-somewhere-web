@group @binding(0) var<uniform> viewMatrix: mat3f;

@vertex fn vs(@location(0) vertex: vec2f) -> @builtin(position) vec4f {
	let pos = viewMatrix * vec3f(vertex, 1.0);
	return vec4f(flatPos.xy, 0.0, 1.0);
}
