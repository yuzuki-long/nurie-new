import { put, list, del } from '@vercel/blob'

const PATHNAME = 'current.json'

async function findBlob() {
  const { blobs } = await list({ prefix: PATHNAME })
  return blobs.find((b) => b.pathname === PATHNAME) || null
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const blob = await findBlob()
      if (!blob) return res.status(200).json(null)
      const r = await fetch(blob.url)
      const data = await r.json()
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const payload = req.body
      await put(PATHNAME, JSON.stringify(payload), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const blob = await findBlob()
      if (blob) await del(blob.url)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
