import { queryClient } from './query'
import { useUi } from '../store/ui'

export async function loadAccount() {
  try {
    useUi.getState().setAccount(await window.aurora.account())
  } catch {
    useUi.getState().setAccount(null)
  }
}

export async function signIn() {
  const account = await window.aurora.signIn()
  if (!account) return
  useUi.getState().setAccount(account)
  useUi.getState().showToast(`Signed in as ${account.name}`)
  queryClient.clear()
}

export async function signOut() {
  await window.aurora.signOut()
  useUi.getState().setAccount(null)
  queryClient.clear()
}
