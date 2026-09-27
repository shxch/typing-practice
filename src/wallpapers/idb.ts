// Minimal IndexedDB blob store for user wallpapers (localStorage is too small for images).

const DB = 'typing-practice'
const STORE = 'wallpapers'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const idbGet = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key))
export const idbPut = (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key))
export const idbDelete = (key: string) => tx('readwrite', (s) => s.delete(key))
