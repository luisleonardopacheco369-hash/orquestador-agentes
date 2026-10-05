import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createAgent, faceYaw, moldAgent, placeAgent, setAgentColor, setAgentScales } from './agent.js'
import { interpret } from './interpret.js'
import {
  applyPlan,
  blendFields,
  cloneField,
  copyField,
  createField,
  findStand,
  heightAt,
  smoothBrush,
  stamp,
} from './terrain-math.js'
import { createSky, createWorldView, moveBrush, rebuildProps, syncTerrain, updatePropHeights } from './world.js'

const view = document.querySelector('#view')
const speech = document.querySelector('#speech')
const log = document.querySelector('#log')
const promptInput = document.querySelector('#prompt')
const seedLabel = document.querySelector('#seed-label')
const face = document.querySelector('#face')
const heightInput = document.querySelector('#agent-height')
const widthInput = document.querySelector('#agent-width')
const radiusInput = document.querySelector('#brush-radius')
const strengthInput = document.querySelector('#brush-strength')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
view.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog('#e7b08a', 32, 110)
scene.add(createSky())
scene.add(new THREE.HemisphereLight('#f6e2c4', '#6a7f55', 1.15))
const sun = new THREE.DirectionalLight('#fff1dc', 1.55)
sun.position.set(28, 36, 12)
scene.add(sun)

const world = createWorldView()
scene.add(world.mesh, world.water, world.trees, world.rocks, world.ring, world.north)

const agent = createAgent()
scene.add(agent.group)

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = !reducedMotion
controls.maxPolarAngle = Math.PI / 2.08
controls.minDistance = 8
controls.maxDistance = 90
controls.mouseButtons.LEFT = -1
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN

let seed = 7
let field = createField(seed, 'land')
const undoStack = []
let mold = null
let mode = 'raise'
const pointer = { down: false, stroke: false, seen: false, x: 0, y: 0 }
const goal = new THREE.Vector3()
let focus = null
const raycaster = new THREE.Raycaster()
const pointerNdc = new THREE.Vector2()

function resize() {
  const width = view.clientWidth
  const height = Math.max(view.clientHeight, 1)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

function syncAll(propsToo) {
  syncTerrain(world, field)
  if (propsToo) rebuildProps(world, field)
  else updatePropHeights(world, field)
}

function showSeed() {
  seedLabel.textContent = `Semilla ${field.seed}`
}

function say(text) {
  speech.textContent = text
  const line = document.createElement('p')
  line.textContent = text
  log.prepend(line)
  while (log.children.length > 4) log.lastChild.remove()
}

function remember() {
  undoStack.push(cloneField(field))
  if (undoStack.length > 12) undoStack.shift()
}

function finishMold() {
  if (!mold) return
  copyField(field, mold.target)
  mold = null
  syncAll(true)
  showSeed()
}

function startMold(plan) {
  finishMold()
  remember()
  const base = cloneField(field)
  const stand = applyPlan(field, plan, 1)
  const target = cloneField(field)
  copyField(field, base)
  syncAll(false)
  const duration = reducedMotion ? 0.01 : plan.intent === 'generate' ? 1.45 : 1.15
  mold = { base, target, t: 0, duration }
  goal.set(stand.x, 0, stand.z)
}

function placeInitial() {
  const stand = findStand(field)
  goal.set(stand.x, 0, stand.z)
  placeAgent(agent, stand.x, stand.z, stand.height)
  controls.target.set(stand.x, 1.2, stand.z)
  camera.position.set(stand.x + 20, 15, stand.z + 22)
  controls.update()
  syncAll(true)
  showSeed()
}

function paintFace() {
  face.style.setProperty('--nara', agent.color)
  document.querySelectorAll('#swatches button').forEach((button) => {
    button.classList.toggle('is-on', button.dataset.color.toLowerCase() === agent.color.toLowerCase())
  })
  heightInput.value = String(agent.heightScale)
  widthInput.value = String(agent.widthScale)
}

function focusAgent() {
  focus = {
    t: 0,
    target: new THREE.Vector3(agent.group.position.x, 1.6, agent.group.position.z),
  }
}

function runCommand(text) {
  const plan = interpret(text)
  say(plan.speech)
  if (plan.intent === 'help') return
  if (plan.intent === 'look') {
    focusAgent()
    return
  }
  if (plan.intent === 'agent') {
    moldAgent(agent, plan.agent)
    paintFace()
    focusAgent()
    return
  }
  if (plan.intent === 'generate') {
    seed = (seed * 17 + 11) % 100000
    plan.seed = seed
  }
  startMold(plan)
}

function brushRadius() {
  return Number(radiusInput.value)
}

function sculpt(dt) {
  if (!pointer.seen) return
  pointerNdc.x = (pointer.x / view.clientWidth) * 2 - 1
  pointerNdc.y = -(pointer.y / view.clientHeight) * 2 + 1
  raycaster.setFromCamera(pointerNdc, camera)
  const hit = raycaster.intersectObject(world.mesh, false)[0]
  if (!hit) {
    world.ring.visible = false
    return
  }
  moveBrush(world, hit.point, brushRadius())
  if (!pointer.down) return
  const power = Number(strengthInput.value) * dt * 0.85
  if (mode === 'smooth') smoothBrush(field, hit.point.x, hit.point.z, brushRadius(), power)
  else stamp(field, hit.point.x, hit.point.z, mode, brushRadius(), power)
  syncAll(false)
}

document.querySelectorAll('.tool').forEach((button) => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode
    document.querySelectorAll('.tool').forEach((item) => item.classList.toggle('is-on', item === button))
  })
})

document.querySelector('#ask').addEventListener('submit', (event) => {
  event.preventDefault()
  const text = promptInput.value.trim()
  if (!text) return
  promptInput.value = ''
  runCommand(text)
})

document.querySelector('#look').addEventListener('click', () => runCommand('quiero verte'))
document.querySelector('#new-world').addEventListener('click', () => runCommand('crea un mundo nuevo'))
document.querySelector('#undo').addEventListener('click', () => {
  finishMold()
  const snapshot = undoStack.pop()
  if (!snapshot) {
    say('No hay nada que deshacer.')
    return
  }
  copyField(field, snapshot)
  syncAll(true)
  showSeed()
  say('Deshice el último moldeado.')
})

heightInput.addEventListener('input', () => {
  setAgentScales(agent, Number(heightInput.value), agent.widthScale)
})
widthInput.addEventListener('input', () => {
  setAgentScales(agent, agent.heightScale, Number(widthInput.value))
})
document.querySelectorAll('#swatches button').forEach((button) => {
  button.addEventListener('click', () => {
    setAgentColor(agent, button.dataset.color)
    paintFace()
  })
})

const canvas = renderer.domElement
canvas.addEventListener('contextmenu', (event) => event.preventDefault())
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  finishMold()
  if (!pointer.stroke) {
    remember()
    pointer.stroke = true
  }
  pointer.down = true
  pointerPosition(event)
  canvas.setPointerCapture(event.pointerId)
})
function pointerPosition(event) {
  const rect = view.getBoundingClientRect()
  pointer.x = event.clientX - rect.left
  pointer.y = event.clientY - rect.top
  pointer.seen = true
}

canvas.addEventListener('pointermove', pointerPosition)
window.addEventListener('pointerup', () => {
  if (!pointer.down && !pointer.stroke) return
  pointer.down = false
  pointer.stroke = false
  rebuildProps(world, field)
})
window.addEventListener('keydown', (event) => {
  if (event.target === promptInput) return
  const keys = { Digit1: 'raise', Digit2: 'lower', Digit3: 'smooth', Digit4: 'water', Digit5: 'forest', Digit6: 'sand', Digit7: 'snow', Digit8: 'rock' }
  const next = keys[event.code]
  if (!next) return
  document.querySelector(`.tool[data-mode="${next}"]`)?.click()
})
window.addEventListener('resize', resize)

placeInitial()
paintFace()
say('Soy Nara. Este mundo es barro vivo: esculpe con el pincel o dime qué cambiar. También puedes moldear mi forma.')
resize()

let last = performance.now()
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  if (mold) {
    mold.t += dt / mold.duration
    if (mold.t >= 1) finishMold()
    else {
      blendFields(field, mold.base, mold.target, mold.t)
      syncAll(false)
    }
  }

  sculpt(dt)

  const ground = heightAt(field, agent.group.position.x, agent.group.position.z)
  const dx = goal.x - agent.group.position.x
  const dz = goal.z - agent.group.position.z
  const distance = Math.hypot(dx, dz)
  if (distance > 0.08) {
    const step = Math.min(distance, dt * 16)
    agent.group.position.x += (dx / distance) * step
    agent.group.position.z += (dz / distance) * step
  }
  const bob = reducedMotion ? 0 : Math.sin(now * 0.002) * 0.06
  placeAgent(agent, agent.group.position.x, agent.group.position.z, ground + bob)
  const facing = distance > 0.4 ? Math.atan2(dx, dz) : Math.atan2(camera.position.x - agent.group.position.x, camera.position.z - agent.group.position.z)
  agent.yaw = faceYaw(agent.yaw, facing, dt, 6)
  agent.group.rotation.y = agent.yaw

  if (focus) {
    focus.t += dt
    focus.target.set(agent.group.position.x, 1.6, agent.group.position.z)
    controls.target.lerp(focus.target, 1 - 0.001 ** dt)
    const offset = camera.position.clone().sub(controls.target)
    const distance = offset.length()
    if (distance > 0.001) {
      offset.multiplyScalar(THREE.MathUtils.damp(distance, 16, 2.4, dt) / distance)
      camera.position.copy(controls.target).add(offset)
    }
    if (focus.t > 1.4) focus = null
  }

  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
