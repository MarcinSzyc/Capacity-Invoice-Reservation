// The only thing web knows about api is its address. Every number it shows was computed there.
export const apiBaseUrl = (): string =>
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
