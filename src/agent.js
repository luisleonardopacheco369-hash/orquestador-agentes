import * as THREE from 'three'

export const DEFAULT_AGENT_COLOR = '#d86b45'

function roundedLabel(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(247, 241, 230, 0.94)'
  context.beginPath()
  context.roundRect(28, 16, 200, 64, 28)
  context.fill()
  context.fillStyle = '#241c16'
  context.font = '600 40px Fraunces, Palatino, Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 128, 50)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(3.4, 1.28, 1)
  return sprite
}

export function createAgent() {
  const group = new THREE.Group()
  const form = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: DEFAULT_AGENT_COLOR,
    roughness: 0.42,
    metalness: 0.05,
    emissive: '#5a2418',
    emissiveIntensity: 0.55,
  })
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.75, 22), material)
  cloak.position.y = 1.05
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 28, 20), material)
  head.position.y = 2.08
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 0.25 })
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), eyeMaterial)
  leftEye.position.set(-0.16, 2.1, 0.4)
  const rightEye = leftEye.clone()
  rightEye.position.x = 0.16
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 12),
    new THREE.MeshStandardMaterial({
      color: '#ffe1bf',
      emissive: '#ffb15a',
      emissiveIntensity: 1.4,
      roughness: 0.18,
    }),
  )
  core.position.set(0, 1.28, 0.78)
  form.add(cloak, head, leftEye, rightEye, core)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 28),
    new THREE.MeshBasicMaterial({ color: '#24180f', transparent: true, opacity: 0.28, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.06

  const label = roundedLabel('Nara')
  label.position.y = 3.05
  const light = new THREE.PointLight('#ffb089', 1.6, 18, 2)
  light.position.y = 2.3

  group.add(form, shadow, label, light)
  return {
    group,
    form,
    material,
    shadow,
    label,
    light,
    heightScale: 1,
    widthScale: 1,
    color: DEFAULT_AGENT_COLOR,
    yaw: 0,
  }
}

function applyScales(agent) {
  agent.form.scale.set(agent.widthScale, agent.heightScale, agent.widthScale)
  agent.label.position.y = 2.2 * agent.heightScale + 0.9
  agent.shadow.scale.set(0.85 * agent.widthScale, 0.85 * agent.widthScale, 1)
}

export function setAgentColor(agent, color) {
  agent.color = color
  agent.material.color.set(color)
  agent.material.emissive.set(color).multiplyScalar(0.28)
  agent.light.color.set(color)
}

export function setAgentScales(agent, heightScale, widthScale) {
  agent.heightScale = Math.min(2.15, Math.max(0.55, heightScale))
  agent.widthScale = Math.min(1.85, Math.max(0.6, widthScale))
  applyScales(agent)
}

export function moldAgent(agent, change) {
  if (change.color) setAgentColor(agent, change.color)
  setAgentScales(
    agent,
    agent.heightScale + (change.heightDelta || 0),
    agent.widthScale + (change.widthDelta || 0),
  )
}

export function placeAgent(agent, x, z, groundY) {
  agent.group.position.set(x, Math.max(groundY, 0.12), z)
}

export function faceYaw(current, target, dt, speed) {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * Math.min(1, dt * speed)
}
