/** `node:path`'s `join`, which is all the shared main modules use. */
export const join = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')
export default { join }
