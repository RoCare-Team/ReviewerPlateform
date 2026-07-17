// Next's bundler resolves extensionless relative imports ("./roles") and bare
// JSON imports; raw Node ESM needs help with both. These hooks bridge the gap so
// the real source runs untouched under plain node.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if (specifier.endsWith(".json")) {
    const r = await next(specifier, context);
    return { ...r, importAttributes: { type: "json" } };
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\.(js|mjs|cjs|json)$/.test(specifier)) {
      try {
        const r = await next(specifier + ".js", context);
        if (existsSync(fileURLToPath(r.url))) return r;
      } catch {}
    }
    throw err;
  }
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return next(url, { ...context, importAttributes: { type: "json" } });
  }
  return next(url, context);
}
