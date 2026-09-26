import { useEffect, useState, type ReactNode } from 'react'
import type { ScrobbleStatus } from '@shared/api'
import type { Settings } from '@shared/api'
import { PageScroll } from '../components/PageScroll'
import { AppMark } from '../components/AppMark'
import { ChevronRightIcon, PersonIcon } from '../components/Icons'
import { useSettings } from '../store/settings'
import { useUi } from '../store/ui'
import { signIn, signOut } from '../lib/account'
import { appLanguage, languageName, TRANSLATION_LANGUAGES } from '../lib/lang'

/** `SettingsSheet.kt`, as a page: grouped inset lists in the iOS settings style. */
export function SettingsScreen() {
  const s = useSettings()
  const account = useUi((u) => u.account)
  return (
    <PageScroll id="settings">
      <h1 className="page-title">Settings</h1>
      <div className="settings">
        <Group title="Account">
          {account ? (
            <>
              <div className="settings-row settings-account">
                <div className="settings-avatar">
                  {account.thumbnailUrl ? <img src={account.thumbnailUrl} alt="" /> : <PersonIcon size={22} />}
                </div>
                <div className="settings-row-text">
                  <div className="settings-row-title">{account.name}</div>
                  {(account.email || account.channelHandle) && (
                    <div className="settings-row-subtitle">{account.email ?? account.channelHandle}</div>
                  )}
                </div>
              </div>
              <Row title="Sign out" destructive onClick={signOut} />
            </>
          ) : (
            <Row title="Sign in to YouTube Music" subtitle="Library, likes and personalised mixes" onClick={signIn} chevron />
          )}
        </Group>

        <Group title="Appearance">
          <Segmented<Settings['theme']>
            title="Theme"
            value={s.theme}
            options={[
              ['system', 'System'],
              ['dark', 'Dark'],
              ['light', 'Light'],
            ]}
            onChange={(theme) => s.update({ theme })}
          />
          <Toggle
            title="Reduce animation"
            subtitle="Cuts instead of springs and fades"
            value={s.reduceAnimation}
            onChange={(reduceAnimation) => s.update({ reduceAnimation })}
          />
        </Group>

        <Group title="Playback">
          <Segmented<Settings['audioQuality']>
            title="Audio quality"
            value={s.audioQuality}
            options={[
              ['high', 'High'],
              ['low', 'Data saver'],
            ]}
            onChange={(audioQuality) => s.update({ audioQuality })}
          />
          <Toggle
            title="Normalize volume"
            subtitle="Evens out loudness between tracks"
            value={s.normalizeVolume}
            onChange={(normalizeVolume) => s.update({ normalizeVolume })}
          />
          <Toggle
            title="Autoplay"
            subtitle="Keep playing similar music when the queue ends"
            value={s.autoplay}
            onChange={(autoplay) => s.update({ autoplay })}
          />
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-title">Crossfade</div>
              <div className="settings-row-subtitle">Overlap the end of a song with the start of the next</div>
            </div>
            <input
              type="range"
              className="settings-slider"
              min={0}
              max={12}
              step={1}
              value={s.crossfadeSeconds}
              onChange={(e) => s.update({ crossfadeSeconds: Number(e.target.value) })}
            />
            <span className="settings-value">{s.crossfadeSeconds ? `${s.crossfadeSeconds}s` : 'Off'}</span>
          </div>
          <Row
            title="Equalizer"
            subtitle={s.eqEnabled ? s.eqPreset : 'Off'}
            chevron
            onClick={() => useUi.getState().push({ kind: 'equalizer' })}
          />
        </Group>

        <Scrobbling />

        <Discord />

        <Group title="Lyrics" footer="Sources are tried in order; the first synced result wins. Translate from the lyrics view.">
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-title">Translate lyrics into</div>
            </div>
            <select className="settings-select" value={s.lyricsTranslateTo} onChange={(e) => s.update({ lyricsTranslateTo: e.target.value })}>
              <option value="">App language ({languageName(appLanguage())})</option>
              {TRANSLATION_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </div>
          {s.lyricsSources.map((source, i) => (
            <div className="settings-row" key={source}>
              <div className="settings-row-text">
                <div className="settings-row-title">{LYRICS_LABEL[source]}</div>
              </div>
              <div className="settings-reorder">
                <button
                  className="text-button"
                  disabled={i === 0}
                  onClick={() => {
                    const list = [...s.lyricsSources]
                    ;[list[i - 1], list[i]] = [list[i], list[i - 1]]
                    s.update({ lyricsSources: list })
                  }}
                >
                  Move up
                </button>
              </div>
            </div>
          ))}
        </Group>

        <Group title="About">
          <div className="settings-row settings-about">
            <AppMark size={44} />
            <div className="settings-row-text">
              <div className="settings-row-title">Aurora Music</div>
              <div className="settings-row-subtitle">Version {__APP_VERSION__}</div>
            </div>
          </div>
          <Row
            title="Aurora Music on GitHub"
            chevron
            onClick={() => window.aurora.openExternal('https://github.com/devops-monk/aurora-music')}
          />
          <div className="settings-legal">
            Aurora Music is free software under the GPLv3, built on open-source work credited in NOTICE.md. It is
            not affiliated with, endorsed by, or connected to YouTube or Google.
          </div>
        </Group>
      </div>
    </PageScroll>
  )
}

const LYRICS_LABEL: Record<Settings['lyricsSources'][number], string> = {
  betterlyrics: 'BetterLyrics (word-synced)',
  lrclib: 'LRCLIB',
  youtube: 'YouTube Music',
}

function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <div className="settings-group-title">{title}</div>
      <div className="settings-card">{children}</div>
      {footer && <div className="settings-group-footer">{footer}</div>}
    </section>
  )
}

function Row({
  title,
  subtitle,
  onClick,
  chevron,
  destructive,
}: {
  title: string
  subtitle?: string
  onClick: () => void
  chevron?: boolean
  destructive?: boolean
}) {
  return (
    <button className={`settings-row is-button ${destructive ? 'is-destructive' : ''}`} onClick={onClick}>
      <div className="settings-row-text">
        <div className="settings-row-title">{title}</div>
        {subtitle && <div className="settings-row-subtitle">{subtitle}</div>}
      </div>
      {chevron && <ChevronRightIcon size={18} className="settings-chevron" />}
    </button>
  )
}

function Toggle({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-row is-button">
      <div className="settings-row-text">
        <div className="settings-row-title">{title}</div>
        {subtitle && <div className="settings-row-subtitle">{subtitle}</div>}
      </div>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Segmented<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <div className="settings-row-title">{title}</div>
      </div>
      <div className="segmented">
        {options.map(([key, label]) => (
          <button key={key} className={key === value ? 'is-selected' : ''} onClick={() => onChange(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** `AccountAndScrobblingScreen.kt`: Last.fm (browser sign-in) and ListenBrainz (user token). */
function Scrobbling() {
  const [status, setStatus] = useState<ScrobbleStatus | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    window.aurora.scrobbleStatus().then(setStatus)
  }, [])
  const run = async (fn: () => Promise<ScrobbleStatus | void>) => {
    setError(null)
    try {
      const next = await fn()
      if (next) setStatus(next)
    } catch (e) {
      setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }
  if (!status) return null
  return (
    <Group
      title="Scrobbling"
      footer={error ?? 'A song counts once you have listened to half of it, or four minutes.'}
    >
      {status.lastfmUser ? (
        <Row title={`Last.fm · ${status.lastfmUser}`} subtitle="Scrobbling" onClick={() => run(() => window.aurora.lastfmSignOut())} destructive />
      ) : waiting ? (
        <Row
          title="Finish Last.fm sign-in"
          subtitle="Approve Aurora Music in your browser, then click here"
          chevron
          onClick={() => run(async () => {
            const s = await window.aurora.lastfmFinishAuth()
            setWaiting(false)
            return s
          })}
        />
      ) : (
        <Row
          title="Connect Last.fm"
          subtitle={status.lastfmAvailable ? 'Opens Last.fm in your browser' : 'Not available in this build'}
          chevron
          onClick={() =>
            status.lastfmAvailable &&
            run(async () => {
              await window.aurora.lastfmBeginAuth()
              setWaiting(true)
            })
          }
        />
      )}
      {status.listenbrainzConnected ? (
        <Row title="ListenBrainz" subtitle="Connected · click to disconnect" destructive onClick={() => run(() => window.aurora.listenbrainzConnect(''))} />
      ) : (
        <form
          className="settings-row"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => window.aurora.listenbrainzConnect(token))
          }}
        >
          <div className="settings-row-text">
            <div className="settings-row-title">ListenBrainz</div>
            <div className="settings-row-subtitle">Paste your user token from listenbrainz.org/settings</div>
          </div>
          <input className="settings-input" type="password" value={token} placeholder="User token" onChange={(e) => setToken(e.target.value)} />
          <button className="pill-button is-small" type="submit" disabled={!token.trim()}>
            Connect
          </button>
        </form>
      )}
    </Group>
  )
}

/** Discord status: a switch, and the Application id to show under. */
function Discord() {
  const { discordEnabled, discordClientId, update } = useSettings()
  const [status, setStatus] = useState<{ connected: boolean; builtInId: boolean } | null>(null)
  const [draft, setDraft] = useState(discordClientId)
  useEffect(() => {
    const poll = () => window.aurora.discordStatus().then(setStatus)
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [])
  const hasId = !!discordClientId || !!status?.builtInId
  return (
    <Group
      title="Discord"
      footer="Shows what you're listening to on your Discord profile while the Discord app is open. Create a free application at discord.com/developers to get an Application ID."
    >
      <label className="settings-row is-button">
        <div className="settings-row-text">
          <div className="settings-row-title">Show as status</div>
          <div className="settings-row-subtitle">
            {!discordEnabled ? 'Off' : !hasId ? 'Needs an Application ID' : status?.connected ? 'Connected to Discord' : 'Waiting for Discord…'}
          </div>
        </div>
        <input type="checkbox" className="switch" checked={discordEnabled} onChange={(e) => update({ discordEnabled: e.target.checked })} />
      </label>
      <form
        className="settings-row"
        onSubmit={(e) => {
          e.preventDefault()
          update({ discordClientId: draft.trim() })
        }}
      >
        <div className="settings-row-text">
          <div className="settings-row-title">Application ID</div>
          <div className="settings-row-subtitle">{status?.builtInId ? 'Optional: overrides the built-in one' : 'From the Discord Developer Portal'}</div>
        </div>
        <input className="settings-input" value={draft} placeholder="e.g. 1234567890123456789" onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))} />
        <button className="pill-button is-small" type="submit" disabled={draft.trim() === discordClientId}>
          Save
        </button>
      </form>
    </Group>
  )
}
