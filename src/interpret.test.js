import assert from 'node:assert/strict'
import test from 'node:test'
import { interpret } from './interpret.js'

test('creates a new world', () => {
  const plan = interpret('crea un mundo nuevo')
  assert.equal(plan.intent, 'generate')
  assert.equal(plan.style, 'land')
  assert.match(plan.speech, /mundo/i)
})

test('reads an accented mountain request in the north', () => {
  const plan = interpret('montañas al norte')
  assert.equal(plan.intent, 'mold')
  assert.equal(plan.world.op, 'raise')
  assert.equal(plan.world.region, 'norte')
})

test('plants a forest to the east', () => {
  const plan = interpret('siembra un bosque al este')
  assert.equal(plan.world.op, 'forest')
  assert.equal(plan.world.region, 'este')
})

test('molds the agent color and height together', () => {
  const plan = interpret('hazte más alta y dorada')
  assert.equal(plan.intent, 'agent')
  assert.equal(plan.agent.color, '#e2a23a')
  assert.equal(plan.agent.heightDelta, 0.28)
})

test('shrinks the agent', () => {
  const plan = interpret('encoge')
  assert.equal(plan.agent.heightDelta, -0.28)
})

test('smooths the whole map', () => {
  const plan = interpret('alisa todo el terreno')
  assert.equal(plan.world.op, 'smooth')
  assert.equal(plan.world.region, 'todo')
})

test('looks at the agent when asked to be seen', () => {
  const plan = interpret('quiero verte')
  assert.equal(plan.intent, 'look')
})

test('opens a river and an island', () => {
  assert.equal(interpret('abre un río').world.op, 'river')
  assert.equal(interpret('crea una isla').intent, 'generate')
  assert.equal(interpret('crea una isla').style, 'island')
})

test('asks for a clearer request when the phrase is empty or unknown', () => {
  assert.equal(interpret('').intent, 'help')
  assert.equal(interpret('hola nara').intent, 'help')
  assert.match(interpret('asdf').speech, /lago/i)
})
