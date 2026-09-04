function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  }

  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x'))
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    if (code.startsWith('#'))
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10))
    return namedEntities[code.toLowerCase()] ?? entity
  })
}

function convertLists(value: string, tag: 'ol' | 'ul') {
  return value.replace(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'), (_, body: string) => {
    let index = 0
    return body.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_item, content: string) => {
      index += 1
      return `${tag === 'ol' ? `${index}.` : '-'} ${content.trim()}\n`
    })
  })
}

/** Converts sanitized editor HTML to the text formatting understood by WhatsApp. */
export function richTextToWhatsAppText(html: string) {
  let value = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '_$2_')
    .replace(/<(s|strike|del)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '~$2~')
    .replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`')

  value = convertLists(convertLists(value, 'ol'), 'ul')
  value = value
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content: string) => `> ${content.trim()}\n`)
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return decodeHtmlEntities(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Produces safe local preview HTML for text already converted to WhatsApp syntax. */
export function whatsAppTextToDisplayHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return escaped
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}
