import { useApp } from '../../src/store/app'

const initial = useApp.getInitialState()

/** Fresh store (and storage) for each test. */
export function resetStore(patch: Partial<ReturnType<typeof useApp.getState>> = {}) {
  localStorage.clear()
  useApp.setState({ ...initial, ...patch }, true)
}

export const configured = { owner: 'o', repo: 'r', token: 't', device: 'mac' }
