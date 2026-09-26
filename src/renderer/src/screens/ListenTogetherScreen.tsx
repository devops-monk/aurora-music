import { useEffect, useState } from 'react'
import { PageScroll } from '../components/PageScroll'
import { PeopleIcon, PersonIcon } from '../components/Icons'
import { Spinner } from '../components/Common'
import { useParty, inParty } from '../store/party'
import { useSettings } from '../store/settings'
import { useUi } from '../store/ui'
import { partyIdentity } from '../audio/party'

const errorText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** `ListenTogetherScreen.kt`: start or join a party, then see who's in it. */
export function ListenTogetherScreen() {
  const party = useParty()
  const { partyServer, update } = useSettings()
  const [defaultServer, setDefaultServer] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverDraft, setServerDraft] = useState(partyServer)
  const [serverState, setServerState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')

  useEffect(() => {
    window.aurora.partyDefaultServer().then(setDefaultServer)
  }, [])
  useEffect(() => setServerDraft(partyServer), [partyServer])

  const server = partyServer || defaultServer
  const run = async (kind: 'create' | 'join') => {
    setError(null)
    setBusy(kind)
    try {
      const who = partyIdentity()
      if (kind === 'create') await window.aurora.partyCreate(who)
      else await window.aurora.partyJoin(code, who)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const saveServer = async () => {
    const address = serverDraft.trim()
    if (!address) return update({ partyServer: '' })
    setServerState('checking')
    const ok = await window.aurora.partyProbe(address)
    setServerState(ok ? 'ok' : 'bad')
    if (ok) update({ partyServer: address })
  }

  if (inParty(party)) {
    const isHost = !!party.you?.isHost
    return (
      <PageScroll id="party">
        <h1 className="page-title">Listen Together</h1>
        <div className="settings">
          <div className="party-hero">
            <div className="party-hero-label">Party code</div>
            <button
              className="party-hero-code"
              title="Copy code"
              onClick={() => {
                navigator.clipboard.writeText(party.code!)
                useUi.getState().showToast('Code copied')
              }}
            >
              {party.code}
            </button>
            <div className="party-hero-status">
              <span className={`party-dot is-${party.status}`} />
              {party.status === 'connected'
                ? `In sync${party.rttMs !== undefined ? ` · ${Math.round(party.rttMs / 2)} ms away` : ''}`
                : party.status === 'reconnecting'
                  ? 'Reconnecting…'
                  : 'Connecting…'}
            </div>
            {party.playback?.startedByName && party.playback.track && (
              <div className="party-hero-now">
                {party.playback.startedByName} picked <b>{party.playback.track.title}</b>
              </div>
            )}
          </div>

          <section className="settings-group">
            <div className="settings-group-title">
              Listeners · {party.members.length}/{party.maxMembers}
            </div>
            <div className="settings-card">
              {party.members.map((m) => (
                <div className="settings-row" key={m.memberId}>
                  <div className="settings-avatar">{m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : <PersonIcon size={20} />}</div>
                  <div className="settings-row-text">
                    <div className="settings-row-title">
                      {m.displayName}
                      {m.memberId === party.you?.memberId && <span className="party-you"> (you)</span>}
                    </div>
                    <div className="settings-row-subtitle">
                      {m.isHost ? 'Host · ' : ''}
                      {m.connected ? 'Listening' : 'Away'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isHost && (
            <section className="settings-group">
              <div className="settings-card">
                <label className="settings-row is-button">
                  <div className="settings-row-text">
                    <div className="settings-row-title">Only I can control the music</div>
                    <div className="settings-row-subtitle">Others can listen but not skip, seek or change the queue</div>
                  </div>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={party.hostOnlyControl}
                    onChange={(e) => window.aurora.partyControl({ action: 'setHostOnlyControl', enabled: e.target.checked })}
                  />
                </label>
              </div>
            </section>
          )}

          {party.error && <div className="party-error">{party.error}</div>}
          <button className="pill-button party-leave" onClick={() => window.aurora.partyLeave()}>
            Leave party
          </button>
        </div>
      </PageScroll>
    )
  }

  return (
    <PageScroll id="party">
      <h1 className="page-title">Listen Together</h1>
      <div className="settings">
        <div className="party-intro">
          <div className="party-intro-icon">
            <PeopleIcon size={34} />
          </div>
          <p>Listen to the same music at the same time with up to five people, on Aurora or BitChord. Anyone in the party can pick songs.</p>
        </div>

        {server ? (
          <>
            <section className="settings-group">
              <div className="settings-card">
                <button className="settings-row is-button" onClick={() => run('create')} disabled={!!busy}>
                  <div className="settings-row-text">
                    <div className="settings-row-title">Start a party</div>
                    <div className="settings-row-subtitle">Get a code to share. What you're playing becomes the party's music</div>
                  </div>
                  {busy === 'create' && <Spinner />}
                </button>
                <form
                  className="settings-row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    run('join')
                  }}
                >
                  <div className="settings-row-text">
                    <div className="settings-row-title">Join with a code</div>
                    <div className="settings-row-subtitle">Six characters, from whoever started it</div>
                  </div>
                  <input
                    className="settings-input party-code-input"
                    value={code}
                    maxLength={8}
                    placeholder="ABC123"
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  />
                  <button className="pill-button is-small" type="submit" disabled={code.length < 6 || !!busy}>
                    {busy === 'join' ? <Spinner size={16} /> : 'Join'}
                  </button>
                </form>
              </div>
              {error && <div className="settings-group-footer party-error-text">{error}</div>}
            </section>
          </>
        ) : null}

        <section className="settings-group">
          <div className="settings-group-title">Server</div>
          <div className="settings-card">
            <form
              className="settings-row"
              onSubmit={(e) => {
                e.preventDefault()
                saveServer()
              }}
            >
              <div className="settings-row-text">
                <div className="settings-row-title">Party server</div>
                <div className="settings-row-subtitle">
                  {serverState === 'checking'
                    ? 'Checking…'
                    : serverState === 'bad'
                      ? 'No party server answered at that address'
                      : partyServer
                        ? partyServer
                        : defaultServer
                          ? `Built in: ${defaultServer}`
                          : 'Needed to start or join parties'}
                </div>
              </div>
              <input
                className="settings-input"
                value={serverDraft}
                placeholder={defaultServer || 'https://party.example.com'}
                onChange={(e) => setServerDraft(e.target.value)}
              />
              <button className="pill-button is-small" type="submit" disabled={serverDraft.trim() === partyServer}>
                Save
              </button>
            </form>
          </div>
        </section>
      </div>
    </PageScroll>
  )
}
