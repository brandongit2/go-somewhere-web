import invariant from "tiny-invariant"

invariant(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, `process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not defined`)
export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
