import { create } from 'zustand'
import type { PartyView } from '@shared/api'

export const useParty = create<PartyView>(() => ({
  status: 'idle',
  members: [],
  maxMembers: 5,
  hostOnlyControl: false,
  offsetMs: 0,
}))

export const inParty = (v: PartyView = useParty.getState()) => v.status !== 'idle' && !!v.code
