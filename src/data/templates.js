// 塗り絵の下絵一覧。
// src は public/templates/ 以下の SVG ファイルを指す。
// 新しい下絵を追加したいときは、public/templates/ に SVG を置いてここに1行足すだけでOK。
export const TEMPLATES = [
  { id: 'tulip', name: 'チューリップ', src: '/templates/tulip.svg' },
  { id: 'fish', name: 'さかな', src: '/templates/fish.svg' },
  { id: 'dog', name: 'いぬ', src: '/templates/dog.svg' },
  { id: 'pudding', name: 'プリン', src: '/templates/pudding.svg' },
  { id: 'apple', name: 'りんご', src: '/templates/apple.svg' },
]

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]
}
