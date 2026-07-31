import { put, list } from '@vercel/blob'

const PATHNAME = 'gallery-index.json'
const MAX_ITEMS = 60

async function findBlob() {
  const { blobs } = await list({ prefix: PATHNAME })
  return blobs.find((b) => b.pathname === PATHNAME) || null
}

async function readIndex() {
  const blob = await findBlob()
  if (!blob) return []
  const r = await fetch(blob.url)
  const data = await r.json()
  return Array.isArray(data.items) ? data.items : []
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const items = await readIndex()
      return res.status(200).json({ items })
    }

    if (req.method === 'POST') {
      const item = req.body
      const items = await readIndex()
      items.unshift(item)
      const trimmed = items.slice(0, MAX_ITEMS)
      await put(PATHNAME, JSON.stringify({ items: trimmed }), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
