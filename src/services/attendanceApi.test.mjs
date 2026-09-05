import assert from 'node:assert/strict'
import test from 'node:test'
import { changeAttendanceMode, retryAttendanceMessage, sendAttendanceMessage } from './attendanceApi.ts'

const apiConversation = { id: 'conversation-1', customerName: 'Maria', phone: '5511999999999', mode: 'Human', unreadCount: 0, lastMessageAt: '2026-09-05T14:00:00Z', version: 3, messages: [] }
function response() { return new Response(JSON.stringify(apiConversation), { status: 200, headers: { 'Content-Type': 'application/json' } }) }

test('handoff envia a versão autoritativa para detectar conflito', async () => {
  const calls = []; const request = async (path, init) => { calls.push({ path, init }); return response() }
  await changeAttendanceMode(request, { id: 'conversation-1', version: 3 }, 'automated')
  assert.deepEqual(JSON.parse(calls[0].init.body), { mode: 'Automated', expectedVersion: 3 })
})

test('envio usa chave idempotente e retentativa identifica a mensagem persistida', async () => {
  const calls = []; const request = async (path, init = {}) => { calls.push({ path, init }); return response() }
  await sendAttendanceMessage(request, 'conversation-1', 'Olá')
  await retryAttendanceMessage(request, 'conversation-1', 'message-1')
  assert.ok(calls[0].init.headers['Idempotency-Key'])
  assert.match(calls[1].path, /messages\/message-1\/retry$/)
})
