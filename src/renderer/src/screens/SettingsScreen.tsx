import type { ReactNode } from 'react'
import type { Settings } from '@shared/api'
import { PageScroll } from '../components/PageScroll'
import { AppMark } from '../components/AppMark'
import { ChevronRightIcon, PersonIcon } from '../components/Icons'
import { useSettings } from '../store/settings'
import { useUi } from '../store/ui'
import { signIn, signOut } from '../lib/account'

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

        <Group title="Lyrics" footer="Sources are tried in order; the first synced result wins.">
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
