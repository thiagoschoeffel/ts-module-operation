import assert from 'node:assert/strict'
import test from 'node:test'
import { richTextToWhatsAppText, whatsAppTextToDisplayHtml } from './whatsappText.ts'

test('converte a formatação compatível para a sintaxe do WhatsApp', () => {
  const html = '<p>Olá <strong>Maria</strong> e <em>bem-vinda</em>.</p><ul><li>Prato</li><li><s>Suco</s></li></ul>'
  assert.equal(richTextToWhatsAppText(html), 'Olá *Maria* e _bem-vinda_.\n- Prato\n- ~Suco~')
})

test('remove formatação visual sem representação no WhatsApp', () => {
  const html = '<h2 style="text-align:center"><span style="color:red">Aviso</span></h2><p><u>Texto</u></p>'
  assert.equal(richTextToWhatsAppText(html), 'Aviso\nTexto')
})

test('gera preview local sem aceitar HTML arbitrário', () => {
  assert.equal(
    whatsAppTextToDisplayHtml('*Olá* <script>alert(1)</script>'),
    '<strong>Olá</strong> &lt;script&gt;alert(1)&lt;/script&gt;'
  )
})
