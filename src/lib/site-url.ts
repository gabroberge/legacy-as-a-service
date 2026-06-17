/** Resolve a site path against Astro `base` (GitHub Pages subpath). */
export function sitePath(path = "/") {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
