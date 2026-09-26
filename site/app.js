// Aurora Music website: small, dependency-free behaviour for the live cards,
// OS-aware download buttons and the release stream.
;(() => {
  const REPO = 'devops-monk/aurora-music'
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── Which OS is this visitor on? ──────────────────────────────────────
  const ua = navigator.userAgent
  const os = /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'win' : /Linux|X11/.test(ua) ? 'linux' : null
  const OS_LABEL = { mac: 'macOS', win: 'Windows', linux: 'Linux' }
  const OS_ICON = {
    mac: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.94c-.02-2.23 1.82-3.3 1.9-3.35-1.04-1.52-2.66-1.73-3.23-1.75-1.37-.14-2.68.81-3.38.81-.7 0-1.77-.79-2.91-.77-1.5.02-2.88.87-3.65 2.21-1.56 2.7-.4 6.7 1.12 8.89.74 1.07 1.62 2.27 2.78 2.23 1.12-.05 1.54-.72 2.89-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.09 2.7-2.16.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.33-.9-2.35-3.59ZM14.15 6.4c.61-.75 1.03-1.78.92-2.81-.89.04-1.96.59-2.6 1.33-.57.66-1.07 1.71-.94 2.72.99.08 2-.5 2.62-1.24Z"/></svg>',
    win: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.1 10.4 4v7.2H3V5.1Zm0 13.8 7.4 1.1v-7.1H3v6Zm8.2 1.2L21 21.5V13h-9.8v7.1Zm0-16.2V11H21V2.5l-9.8 1.4Z"/></svg>',
    linux: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-2.2 0-3.6 2-3.6 4.7 0 1.3.3 2.3.1 3.3-.3 1.4-2.6 3.6-3.2 6.1-.4 1.8.5 2.4 1.4 2.9-.1.8.4 1.7 1.6 2 1.5.4 2.6-.5 3.6-.5s2.1.9 3.6.5c1.2-.3 1.7-1.2 1.6-2 .9-.5 1.8-1.1 1.4-2.9-.6-2.5-2.9-4.7-3.2-6.1-.2-1 .1-2 .1-3.3C15.6 4 14.2 2 12 2Z"/></svg>',
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

  // ── Screenshot tabs ───────────────────────────────────────────────────
  const shotImg = $('[data-shot-img]')
  $$('[data-shot]').forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-shot]').forEach((x) => x.setAttribute('aria-selected', String(x === b)))
      shotImg.style.opacity = '0'
      const next = new Image()
      next.src = `/assets/shots/${b.dataset.shot}.webp`
      next.onload = () => {
        shotImg.src = next.src
        shotImg.style.opacity = '1'
      }
    }),
  )

  // ── Lyrics card: words fill as they're "sung" ─────────────────────────
  const lines = $$('[data-lyrics] p')
  const LINE_MS = [2600, 2800, 1300, 2400, 2600]
  let lineIndex = 0
  let lineStart = performance.now()
  lines.forEach((p, i) =>
    p.addEventListener('click', () => {
      lineIndex = i
      lineStart = performance.now()
    }),
  )
  function tickLyrics(now) {
    const elapsed = now - lineStart
    const dur = LINE_MS[lineIndex]
    if (elapsed > dur + 400) {
      lineIndex = (lineIndex + 1) % lines.length
      lineStart = now
    }
    lines.forEach((p, i) => {
      p.classList.toggle('active', i === lineIndex)
      p.classList.toggle('past', i < lineIndex)
    })
    const words = $$('span', lines[lineIndex])
    const per = dur / words.length
    words.forEach((w, i) => w.style.setProperty('--p', String(Math.min(1, Math.max(0, (elapsed - i * per) / per)))))
    requestAnimationFrame(tickLyrics)
  }
  if (lines.length && !reduce) requestAnimationFrame(tickLyrics)
  else lines[0]?.classList.add('active')

  // ── Crossfade card: equal-power curves (the engine's sin/cos fades) ───
  const fadeSvg = $('[data-fade]')
  const fadeRange = $('[data-fade-range]')
  const fadeOut = $('[data-fade-out]')
  function drawFade() {
    const s = Number(fadeRange.value)
    fadeOut.textContent = s ? `${s}s` : 'Gapless'
    const W = 300
    const H = 100
    const top = 8
    const mid = W / 2
    const half = (s / 12) * (W * 0.42)
    const y = (g) => top + (1 - g) * (H - top)
    const pts = (fn) => {
      let d = ''
      for (let x = 0; x <= W; x += 3) d += `${x ? 'L' : 'M'}${x},${y(fn(x)).toFixed(1)}`
      return d
    }
    const t = (x) => (half ? Math.min(1, Math.max(0, (x - (mid - half)) / (2 * half))) : x < mid ? 0 : 1)
    $('.fade-out', fadeSvg).setAttribute('d', pts((x) => Math.cos((t(x) * Math.PI) / 2)))
    $('.fade-in', fadeSvg).setAttribute('d', pts((x) => Math.sin((t(x) * Math.PI) / 2)))
  }
  fadeRange?.addEventListener('input', drawFade)
  if (fadeSvg) drawFade()
  const head = $('.fade-head')
  let headX = 0
  if (head && !reduce)
    setInterval(() => {
      headX = (headX + 2) % 300
      head.setAttribute('x1', headX)
      head.setAttribute('x2', headX)
    }, 40)

  // ── EQ card: real biquad responses, computed like the app does ────────
  const PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0],
    'Bass Boost': [6, 4, 1.5, 0, 0, 0, 0],
    Vocal: [-3, -1.5, 1, 3.5, 3, 1, -1],
    Electronic: [5, 3, -1, 0, 1, 3, 4],
    Rock: [4, 2.5, -1, -1.5, 1, 3, 3.5],
    'Late Night': [3, 1, 0, 1.5, 1, -1, -3],
  }
  const BANDS = [60, 150, 400, 1000, 2500, 6000, 14000]
  const chips = $('[data-eq-presets]')
  function response(bands) {
    const N = 120
    const freqs = new Float32Array(N).map((_, i) => 20 * Math.pow(1000, i / (N - 1)))
    const total = new Float32Array(N)
    try {
      const ctx = new OfflineAudioContext(1, 1, 44100)
      const mag = new Float32Array(N)
      const phase = new Float32Array(N)
      BANDS.forEach((hz, i) => {
        const f = ctx.createBiquadFilter()
        f.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'
        f.frequency.value = hz
        f.Q.value = 1
        f.gain.value = bands[i]
        f.getFrequencyResponse(freqs, mag, phase)
        for (let k = 0; k < N; k++) total[k] += 20 * Math.log10(mag[k])
      })
    } catch {
      /* no Web Audio: flat line */
    }
    return total
  }
  function drawEq(name) {
    const db = response(PRESETS[name])
    const W = 300
    const H = 100
    const y = (v) => H / 2 - (v / 12) * (H / 2 - 6)
    let d = ''
    db.forEach((v, i) => (d += `${i ? 'L' : 'M'}${((i / (db.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`))
    $('[data-eq-line]').setAttribute('d', d)
    $('[data-eq-fill]').setAttribute('d', `${d}L${W},${H / 2}L0,${H / 2}Z`)
    $$('button', chips).forEach((b) => b.classList.toggle('on', b.textContent === name))
  }
  if (chips) {
    Object.keys(PRESETS).forEach((name) => {
      const b = document.createElement('button')
      b.textContent = name
      b.addEventListener('click', () => drawEq(name))
      chips.appendChild(b)
    })
    drawEq('Electronic')
  }

  // ── Listen Together card: three devices, one playhead ─────────────────
  const partyBars = $$('[data-party] .bar em')
  const drift = $('[data-drift]')
  const SONG_MS = 24000
  const partyStart = performance.now()
  function tickParty(now) {
    const p = ((now - partyStart) % SONG_MS) / SONG_MS
    partyBars.forEach((bar, i) => (bar.style.transform = `scaleX(${Math.min(1, p + (i - 1) * 0.0015)})`))
    requestAnimationFrame(tickParty)
  }
  if (partyBars.length && !reduce) requestAnimationFrame(tickParty)
  if (drift && !reduce) setInterval(() => (drift.textContent = `±${6 + Math.round(Math.random() * 14)} ms`), 1600)

  // ── Offline card: a download filling up ───────────────────────────────
  const ring = $('[data-ring]')
  const ringText = $('[data-ring-text]')
  let dl = 0
  if (ring && !reduce)
    setInterval(() => {
      dl = dl >= 1 ? 0 : Math.min(1, dl + 0.035)
      ring.style.setProperty('--p', String(dl))
      ringText.textContent = dl >= 1 ? 'Downloaded' : `Downloading · ${Math.round(dl * 100)}%`
    }, 120)

  // Discord progress bar
  const discordBar = $('.discord .bar em')
  if (discordBar && !reduce) {
    const start = performance.now()
    const loop = (now) => {
      discordBar.style.transform = `scaleX(${((now - start) % 60000) / 60000})`
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  // ── Live GitHub data: stars, releases, and real download links ────────
  const ASSET_MATCH = {
    'mac-universal.dmg': (n) => /mac.*\.dmg$/i.test(n),
    'win-x64.exe': (n) => /win.*\.exe$/i.test(n) && !/portable/i.test(n),
    'linux-x86_64.AppImage': (n) => /\.AppImage$/i.test(n),
  }
  const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  function notesToList(body) {
    const items = (body || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*] /.test(l))
      .slice(0, 5)
      .map((l) => `<li>${esc(l.replace(/^[-*] /, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</li>`)
    return items.length ? `<ul>${items.join('')}</ul>` : ''
  }

  function releaseCard(r, latest) {
    const assets = (r.assets || [])
      .filter((a) => /\.(dmg|zip|exe|AppImage|deb|rpm)$/.test(a.name))
      .map((a) => `<a href="${a.browser_download_url}">${esc(a.name.replace(/^Aurora-Music-[\d.]+-/, ''))} · ${(a.size / 1048576).toFixed(0)} MB</a>`)
      .join('')
    return `<article class="release${latest ? ' latest' : ''}">
      <header><b>${esc(r.tag_name)}</b>${latest ? '<span class="tag">latest</span>' : ''}<time>${fmtDate(r.published_at)}</time></header>
      <h3>${esc(r.name || r.tag_name)}</h3>
      ${notesToList(r.body)}
      ${assets ? `<div class="release-assets">${assets}</div>` : ''}
    </article>`
  }

  fetch(`https://api.github.com/repos/${REPO}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((repo) => {
      if (!repo) return
      const stars = $('[data-stars]')
      stars.textContent = repo.stargazers_count.toLocaleString()
      stars.hidden = false
    })
    .catch(() => undefined)

  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=6`)
    .then((r) => (r.ok ? r.json() : null))
    .then((releases) => {
      const list = (releases || []).filter((r) => !r.draft)
      if (!list.length) return
      $('[data-releases]').innerHTML = list.map((r, i) => releaseCard(r, i === 0)).join('')
      $('[data-releases-sub]').textContent = `${list.length} published build${list.length === 1 ? '' : 's'}, pulled live from GitHub Releases.`
      $$('[data-latest]').forEach((el) => (el.textContent = list[0].tag_name))
      const assets = list[0].assets || []
      $$('[data-asset]').forEach((a) => {
        const found = assets.find((x) => ASSET_MATCH[a.dataset.asset]?.(x.name))
        if (found) a.href = found.browser_download_url
      })
      const primary = os && assets.find((x) => ASSET_MATCH[{ mac: 'mac-universal.dmg', win: 'win-x64.exe', linux: 'linux-x86_64.AppImage' }[os]](x.name))
      if (primary) $$('[data-download]').forEach((a) => (a.href = primary.browser_download_url))
    })
    .catch(() => undefined)

  // Until GitHub answers (or if it can't), download buttons lead to the release page.
  $$('[data-asset]').forEach((a) => {
    if (a.getAttribute('href') === '#') a.href = `https://github.com/${REPO}/releases/latest`
  })
})()
