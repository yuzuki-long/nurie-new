import { useEffect, useState, useCallback } from 'react'
import { TEMPLATES, getTemplate } from './data/templates.js'
import { loadCurrent, saveCurrent, addToGallery, loadGallery } from './storage.js'
import ColoringCanvas from './ColoringCanvas.jsx'

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function MainMenu({ onNewPicker, onContinue, onGallery, hasCurrent }) {
  return (
    <div className="screen menu-screen">
      <h1 className="menu-title">おえかき<span>ぬりえ</span></h1>
      <p className="menu-sub">すきな いろで じゆうに ぬってみよう</p>
      <div className="menu-list">
        <button className="menu-button primary" onClick={onNewPicker}>
          <span className="icon-badge">🎨</span>
          <span>
            あたらしいぬりえ
            <span className="label-sub">したえを えらんで はじめる</span>
          </span>
        </button>
        <button className="menu-button continue" onClick={onContinue} disabled={!hasCurrent}>
          <span className="icon-badge">✏️</span>
          <span>
            つづきからぬる
            <span className="label-sub">{hasCurrent ? 'さいごの つづきから' : 'まだ ぬりえが ありません'}</span>
          </span>
        </button>
        <button className="menu-button gallery" onClick={onGallery}>
          <span className="icon-badge">📚</span>
          <span>
            ぬりえをみる
            <span className="label-sub">ほんだなに かざってあるよ</span>
          </span>
        </button>
        <button className="menu-button create disabled" disabled>
          <span className="icon-badge">🧩</span>
          <span>
            ぬりえをつくる
            <span className="label-sub">じゅんびちゅう</span>
          </span>
        </button>
      </div>
    </div>
  )
}

function TemplatePicker({ onBack, onSelect }) {
  return (
    <div className="screen">
      <div className="picker-header">
        <button className="back-button" onClick={onBack} aria-label="もどる">←</button>
        <span className="picker-title">したえを えらんでね</span>
      </div>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="template-card" onClick={() => onSelect(t.id)}>
            <img src={t.src} alt={t.name} />
            <span className="template-name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Bookshelf({ onBack, items }) {
  // 1棚あたり5冊で区切って、複数の本棚を積む
  const shelves = []
  const perShelf = 5
  for (let i = 0; i < Math.max(items.length, 1); i += perShelf) {
    shelves.push(items.slice(i, i + perShelf))
  }
  if (items.length === 0) shelves[0] = []

  return (
    <div className="screen bookshelf-screen">
      <div className="bookshelf-header">
        <button className="back-button" onClick={onBack} aria-label="もどる">←</button>
        <span className="picker-title">ぬりえのほんだな</span>
      </div>
      <div className="bookshelf-scroll">
        {shelves.map((shelf, i) => (
          <div className="shelf-unit" key={i}>
            <div className="shelf-books">
              {shelf.length === 0 ? (
                <div className="shelf-empty">まだ ぬりえが ないよ。<br />あたらしく ぬってみよう！</div>
              ) : (
                shelf.map((item) => {
                  const tpl = getTemplate(item.templateId)
                  return (
                    <div className="shelf-book" key={item.id}>
                      <img src={item.thumbnail || tpl.src} alt={tpl.name} />
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [current, setCurrent] = useState(null) // { templateId, strokes, thumbnail, updatedAt }
  const [galleryItems, setGalleryItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const c = await loadCurrent()
      setCurrent(c)
      setLoading(false)
    })()
  }, [])

  const refreshGallery = useCallback(async () => {
    const items = await loadGallery()
    setGalleryItems(items)
  }, [])

  const goMenu = () => setScreen('menu')

  const handleNewPicker = () => setScreen('picker')

  const handleSelectTemplate = async (templateId) => {
    // 直前のぬりえに何か描かれていれば、本棚に保存してから新しいぬりえを始める
    if (current && current.strokes && current.strokes.length > 0) {
      await addToGallery({
        id: makeId(),
        templateId: current.templateId,
        thumbnail: current.thumbnail,
        savedAt: Date.now(),
      })
    }
    const fresh = { templateId, strokes: [], thumbnail: null, updatedAt: Date.now() }
    await saveCurrent(fresh)
    setCurrent(fresh)
    setScreen('coloring')
  }

  const handleContinue = () => {
    if (current) setScreen('coloring')
  }

  const handleOpenGallery = async () => {
    await refreshGallery()
    setScreen('gallery')
  }

  const handleExitColoring = async () => {
    // 最新の状態を読み直してからメニューへ戻る(自動保存済み)
    const c = await loadCurrent()
    setCurrent(c)
    setScreen('menu')
  }

  if (loading) {
    return <div className="screen menu-screen" />
  }

  if (screen === 'coloring' && current) {
    return (
      <ColoringCanvas
        template={getTemplate(current.templateId)}
        initialStrokes={current.strokes}
        onBack={handleExitColoring}
      />
    )
  }

  if (screen === 'picker') {
    return <TemplatePicker onBack={goMenu} onSelect={handleSelectTemplate} />
  }

  if (screen === 'gallery') {
    return <Bookshelf onBack={goMenu} items={galleryItems} />
  }

  return (
    <MainMenu
      onNewPicker={handleNewPicker}
      onContinue={handleContinue}
      onGallery={handleOpenGallery}
      hasCurrent={!!(current && current.strokes && current.strokes.length > 0)}
    />
  )
}
