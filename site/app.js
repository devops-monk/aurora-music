// Aurora Music website: the sung headline, artwork tints that follow the
// scroll, the lyrics toggle and screen shelf, OS-aware download buttons, and
// the live release list. No dependencies.
;(() => {
  const REPO = 'devops-monk/aurora-music'
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── The sung headline ─────────────────────────────────────────────────
  // Like the app's lyrics: one line lit and filling word by word, the line
  // before it settled, the next one waiting, and the list scrolling up.
  const sung = $('[data-sung]')
  if (sung) {
    const lines = $$('p', sung)
    lines.forEach((p) => {
      p.innerHTML = p.textContent
        .split(' ')
        .map((w) => `<span class="w">${w}</span>`)
        .join(' ')
    })
    const track = document.createElement('div')
    track.className = 'sung-track'
    lines.forEach((p) => track.appendChild(p))
    sung.appendChild(track)

    const WORD_MS = 420
    const HOLD_MS = 1300
    let index = 0
    let start = performance.now()
    const place = () => {
      // Keep the lit line in the middle row of the three visible.
      track.style.transform = `translateY(calc(var(--line-h) * ${1 - index}))`
      lines.forEach((p, i) => {
        p.classList.toggle('is-active', i === index)
        p.classList.toggle('is-past', i < index)
      })
    }
    const words = () => $$('.w', lines[index])
    const tick = (now) => {
      const ws = words()
      const elapsed = now - start
      ws.forEach((w, i) => w.style.setProperty('--p', String(Math.min(1, Math.max(0, (elapsed - i * WORD_MS) / WORD_MS)))))
      if (elapsed > ws.length * WORD_MS + HOLD_MS) {
        if (index === lines.length - 1) {
          // Rest on the last line a little longer, then start the song again.
          if (elapsed > ws.length * WORD_MS + HOLD_MS * 3) {
            lines.forEach((p) => $$('.w', p).forEach((w) => w.style.setProperty('--p', '0')))
            index = 0
            start = now
            place()
          }
        } else {
          index += 1
          start = now
          place()
        }
      }
      requestAnimationFrame(tick)
    }
    if (reduce) {
      index = 1
      place()
      $$('.w', lines[1]).forEach((w) => w.style.setProperty('--p', '1'))
    } else {
      place()
      requestAnimationFrame(tick)
    }
  }

  // ── Artwork tints ─────────────────────────────────────────────────────
  // The page takes the colour of whichever section is under the middle of
  // the screen, the way the app tints a page from its artwork.
  const tinted = $$('[data-tint]')
  const meta = $('meta[name="theme-color"]')
  const setTint = (c) => {
    document.documentElement.style.setProperty('--tint', c)
    meta?.setAttribute('content', c)
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setTint(e.target.dataset.tint)),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    tinted.forEach((s) => io.observe(s))
  }

  // ── Lyrics toggle: Original / हिन्दी ─────────────────────────────────
  const lyricImg = $('[data-lyric-img]')
  $$('[data-lyric-toggle] button').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return
      $$('[data-lyric-toggle] button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      const next = new Image()
      next.src = b.dataset.src
      lyricImg.style.opacity = '0'
      next.onload = () => {
        lyricImg.src = next.src
        lyricImg.alt = b.dataset.alt
        lyricImg.style.opacity = '1'
      }
    }),
  )

  // ── Screen shelf arrows ───────────────────────────────────────────────
  const shelf = $('[data-tour]')
  const page = (dir) => shelf.scrollBy({ left: dir * shelf.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  $('[data-tour-prev]')?.addEventListener('click', () => page(-1))
  $('[data-tour-next]')?.addEventListener('click', () => page(1))

  // ── Which OS is this visitor on? ──────────────────────────────────────
  const ua = navigator.userAgent
  // Android before Linux: phones report both.
  const os = /Android/.test(ua) ? 'android' : /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'win' : /Linux|X11/.test(ua) ? 'linux' : null
  const OS_LABEL = { mac: 'macOS', win: 'Windows', linux: 'Linux', android: 'Android' }
  const OS_ICON = {
    mac: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.94c-.02-2.23 1.82-3.3 1.9-3.35-1.04-1.52-2.66-1.73-3.23-1.75-1.37-.14-2.68.81-3.38.81-.7 0-1.77-.79-2.91-.77-1.5.02-2.88.87-3.65 2.21-1.56 2.7-.4 6.7 1.12 8.89.74 1.07 1.62 2.27 2.78 2.23 1.12-.05 1.54-.72 2.89-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.09 2.7-2.16.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.33-.9-2.35-3.59ZM14.15 6.4c.61-.75 1.03-1.78.92-2.81-.89.04-1.96.59-2.6 1.33-.57.66-1.07 1.71-.94 2.72.99.08 2-.5 2.62-1.24Z"/></svg>',
    win: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.1 10.4 4v7.2H3V5.1Zm0 13.8 7.4 1.1v-7.1H3v6Zm8.2 1.2L21 21.5V13h-9.8v7.1Zm0-16.2V11H21V2.5l-9.8 1.4Z"/></svg>',
    android: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.48 19.44 6.3a.38.38 0 0 0-.66-.38l-1.87 3.23a11.4 11.4 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52ZM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"/></svg>',
    linux: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c-2.2 0-3.6 2-3.6 4.7 0 1.3.3 2.3.1 3.3-.3 1.4-2.6 3.6-3.2 6.1-.4 1.8.5 2.4 1.4 2.9-.1.8.4 1.7 1.6 2 1.5.4 2.6-.5 3.6-.5s2.1.9 3.6.5c1.2-.3 1.7-1.2 1.6-2 .9-.5 1.8-1.1 1.4-2.9-.6-2.5-2.9-4.7-3.2-6.1-.2-1 .1-2 .1-3.3C15.6 4 14.2 2 12 2Z"/></svg>',
  }
  if (os) {
    $$('[data-download-label]').forEach((el) => (el.textContent = `Download for ${OS_LABEL[os]}`))
    $$('[data-os-icon]').forEach((el) => (el.innerHTML = OS_ICON[os]))
    selectOs(os)
  }

  // ── Install tabs ──────────────────────────────────────────────────────
  function selectOs(which) {
    $$('[data-os-tabs] button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.os === which)))
    $$('[data-os-panel]').forEach((p) => (p.hidden = p.dataset.osPanel !== which))
  }
  $$('[data-os-tabs] button').forEach((b) => b.addEventListener('click', () => selectOs(b.dataset.os)))

  // ── Live GitHub data: stars, releases, and real download links ────────
  const ASSET_MATCH = {
    'mac-universal.dmg': (n) => /mac.*\.dmg$/i.test(n),
    // The combined x64 + ARM64 installer.
    'win-x64.exe': (n) => /-win-setup\.exe$/i.test(n),
    'win-portable.exe': (n) => /-win-portable\.exe$/i.test(n),
    'linux-x86_64.AppImage': (n) => /\.AppImage$/i.test(n),
    'android.apk': (n) => /-android\.apk$/i.test(n),
  }
  const ASSET_LABEL = [
    [/mac.*\.dmg$/i, 'macOS disk image'],
    [/mac.*\.zip$/i, 'macOS zip'],
    [/-win-setup\.exe$/i, 'Windows installer'],
    [/-win-portable\.exe$/i, 'Windows portable'],
    [/\.AppImage$/i, 'Linux AppImage'],
    [/\.deb$/i, 'Linux .deb'],
    [/\.rpm$/i, 'Linux .rpm'],
    [/-android\.apk$/i, 'Android APK'],
  ]
  const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  function notesToList(body) {
    const items = (body || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*] /.test(l) && !/Full Changelog/i.test(l))
      .slice(0, 5)
      .map((l) => `<li>${esc(l.replace(/^[-*] /, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</li>`)
    return items.length ? `<ul>${items.join('')}</ul>` : ''
  }

  function releaseCard(r, latest) {
    const assets = (r.assets || [])
      .map((a) => {
        const label = ASSET_LABEL.find(([re]) => re.test(a.name))?.[1]
        return label && `<a href="${a.browser_download_url}">${label}, ${(a.size / 1048576).toFixed(0)} MB</a>`
      })
      .filter(Boolean)
      .join('')
    return `<article class="release${latest ? ' latest' : ''}">
      <header><b>${esc(r.tag_name)}</b>${latest ? '<span class="tag">Latest</span>' : ''}<time>${fmtDate(r.published_at)}</time></header>
      <h3>${esc(r.name || r.tag_name)}</h3>
      ${notesToList(r.body)}
      ${assets ? `<div class="release-assets">${assets}</div>` : ''}
    </article>`
  }

  fetch(`https://api.github.com/repos/${REPO}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((repo) => {
      if (!repo?.stargazers_count) return
      const stars = $('[data-stars]')
      stars.textContent = repo.stargazers_count.toLocaleString()
      stars.hidden = false
    })
    .catch(() => undefined)

  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=3`)
    .then((r) => (r.ok ? r.json() : null))
    .then((releases) => {
      const list = (releases || []).filter((r) => !r.draft)
      if (!list.length) return
      // Only the current build: older ones stay on GitHub for anyone who needs them.
      $('[data-releases]').innerHTML = releaseCard(list[0], true)
      $$('[data-latest]').forEach((el) => (el.textContent = list[0].tag_name))
      const assets = list[0].assets || []
      $$('[data-asset]').forEach((a) => {
        const found = assets.find((x) => ASSET_MATCH[a.dataset.asset]?.(x.name))
        if (found) a.href = found.browser_download_url
      })
      const primary = os && assets.find((x) => ASSET_MATCH[{ mac: 'mac-universal.dmg', win: 'win-x64.exe', linux: 'linux-x86_64.AppImage', android: 'android.apk' }[os]](x.name))
      if (primary) $$('[data-download]').forEach((a) => (a.href = primary.browser_download_url))
    })
    .catch(() => undefined)

  // Until GitHub answers (or if it can't), download buttons lead to the release page.
  $$('[data-asset]').forEach((a) => {
    if (a.getAttribute('href') === '#') a.href = `https://github.com/${REPO}/releases/latest`
  })
})()
