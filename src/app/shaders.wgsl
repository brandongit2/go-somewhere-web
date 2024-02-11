@vertex fn vs(@location(0) vertex: vec2f) -> @builtin(position) vec4f {
	let flatPos = vertex * vec2f(2.0, 2.0) - vec2f(1.0, 1.0);
	return vec4f(flatPos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
	return vec4f(0.0, 0.0, 1.0, 1.0);
}
