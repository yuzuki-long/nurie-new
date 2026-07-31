// データ保存レイヤー。
// 本番(Vercel)では /api/current, /api/gallery が Vercel Blob を読み書きする。
// ローカルで `npm run dev` (vite単体)している時や、API未設定の時は
// 自動的に localStorage にフォールバックするので、開発中も動作確認できる。

const LOCAL_CURRENT_KEY = 'nurie:current'
const LOCAL_GALLERY_KEY = 'nurie:gallery'

async function tryApi(path, options) {
  try {
    const res = await fetch(path, options)
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, data }
  } catch (e) {
    return { ok: false }
  }
}

// ---- 「途中のぬりえ」(つづきからぬる用) ----

export async function loadCurrent() {
  const api = await tryApi('/api/current')
  if (api.ok) return api.data
  const raw = localStorage.getItem(LOCAL_CURRENT_KEY)
  return raw ? JSON.parse(raw) : null
}

export async function saveCurrent(payload) {
  // payload: { templateId, strokes, updatedAt }
  const api = await tryApi('/api/current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!api.ok) {
    localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(payload))
  }
}

export async function clearCurrent() {
  const api = await tryApi('/api/current', { method: 'DELETE' })
  if (!api.ok) {
    localStorage.removeItem(LOCAL_CURRENT_KEY)
  }
}

// ---- 「本棚」(ぬりえをみる用) ----

export async function loadGallery() {
  const api = await tryApi('/api/gallery')
  if (api.ok) return api.data.items || []
  const raw = localStorage.getItem(LOCAL_GALLERY_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function addToGallery(item) {
  // item: { id, templateId, thumbnail, savedAt }
  const api = await tryApi('/api/gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  if (!api.ok) {
    const raw = localStorage.getItem(LOCAL_GALLERY_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift(item)
    localStorage.setItem(LOCAL_GALLERY_KEY, JSON.stringify(list))
  }
}
