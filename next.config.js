/** @type {import('next').NextConfig} */
const nextConfig = {
	headers: async () => [
		{
			source: `/:slug*`,
			headers: [
				{
					key: `Cross-Origin-Opener-Policy`,
					value: `same-origin`,
				},
				{
					key: `Cross-Origin-Embedder-Policy`,
					value: `require-corp`,
				},
			],
		},
	],
	webpack: (config) => {
		config.module.rules.push({
			test: /\.wgsl$/,
			type: `asset/source`,
		})
		return config
	},
}

export default nextConfig
