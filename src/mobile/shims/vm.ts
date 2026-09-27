/**
 * youtubei.js deciphers stream URLs with functions it extracts from
 * YouTube's player script. On the desktop they run in a bare V8 context; in
 * the WebView they run as a plain function with the same two globals.
 */
function runInNewContext(code: string, context: Record<string, unknown>): unknown {
  const names = Object.keys(context)
  return new Function(...names, `return ${code}`)(...names.map((n) => context[n]))
}

export default { runInNewContext }
