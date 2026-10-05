import * as THREE from 'three'
import {
  FOREST,
  GRASS,
  ROCK,
  SAND,
  SEGMENTS,
  SIZE,
  SNOW,
  WATER,
  cellPosition,
  heightAt,
} from './terrain-math.js'

const BIOME_COLOR = {
  [GRASS]: [0.46, 0.6, 0.31],
  [SAND]: [0.79, 0.68, 0.44],
  [ROCK]: [0.5, 0.46, 0.43],
  [SNOW]: [0.94, 0.95, 0.96],
  [FOREST]: [0.15, 0.36, 0.2],
  [WATER]: [0.13, 0.4, 0.46],
}

function northMarker() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  context.fillStyle = 'rgba(247, 241, 230, 0.92)'
  context.beginPath()
  context.roundRect(48, 16, 160, 64, 28)
  context.fill()
  context.fillStyle = '#241c16'
  context.font = '600 42px Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('N', 128, 50)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(4.2, 1.55, 1)
  sprite.position.set(0, 4, -SIZE / 2 + 4)
  return sprite
}

function shade(color, height) {
  const light = 0.78 + Math.min(Math.max(height, -2), 8) / 28
  return color.map((channel) => Math.min(1, channel * light))
}

function hash(index) {
  let value = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

export function createSky() {
  const geometry = new THREE.SphereGeometry(180, 32, 20)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#f6e2c4') },
      horizon: { value: new THREE.Color('#e39a68') },
      bottom: { value: new THREE.Color('#6d9084') },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      void main() {
        float height = normalize(vPosition).y;
        vec3 color = mix(horizon, top, smoothstep(0.0, 0.55, height));
        color = mix(bottom, color, smoothstep(-0.25, 0.08, height));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
  return new THREE.Mesh(geometry, material)
}

export function createWorldView() {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  geometry.rotateX(-Math.PI / 2)
  const colors = new Float32Array(geometry.attributes.position.count * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 })
  const mesh = new THREE.Mesh(geometry, material)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE * 1.4, SIZE * 1.4),
    new THREE.MeshStandardMaterial({
      color: '#2f6f76',
      transparent: true,
      opacity: 0.62,
      roughness: 0.12,
      metalness: 0.08,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.16
  water.renderOrder = 2

  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.45, 2.1, 7),
    new THREE.MeshStandardMaterial({ color: '#1d4a30', roughness: 0.8 }),
    650,
  )
  trees.count = 0
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.45, 0),
    new THREE.MeshStandardMaterial({ color: '#6d655e', roughness: 0.95 }),
    240,
  )
  rocks.count = 0

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({ color: '#fff6e8', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.visible = false

  const north = northMarker()

  return { mesh, geometry, water, trees, rocks, ring, north, treeSpots: [], rockSpots: [] }
}

export function syncTerrain(view, field) {
  const position = view.geometry.attributes.position
  const color = view.geometry.attributes.color
  for (let index = 0; index < field.heights.length; index += 1) {
    const height = field.heights[index]
    position.setY(index, height)
    const [r, g, b] = shade(BIOME_COLOR[field.biomes[index]] || BIOME_COLOR[GRASS], height)
    color.setXYZ(index, r, g, b)
  }
  position.needsUpdate = true
  color.needsUpdate = true
  view.geometry.computeVertexNormals()
}

function writeInstances(mesh, spots, field, lift) {
  const dummy = new THREE.Object3D()
  spots.forEach((spot, index) => {
    const ground = Math.max(heightAt(field, spot.x, spot.z), 0)
    dummy.position.set(spot.x, ground + lift(spot), spot.z)
    dummy.scale.set(spot.sx, spot.sy, spot.sz)
    dummy.rotation.y = spot.rotation
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  })
  mesh.count = spots.length
  mesh.instanceMatrix.needsUpdate = true
}

export function rebuildProps(view, field) {
  const trees = []
  const rocks = []
  const res = field.res
  for (let iy = 2; iy < res - 2; iy += 4) {
    for (let ix = 2; ix < res - 2; ix += 4) {
      const index = iy * res + ix
      const biome = field.biomes[index]
      const point = cellPosition(ix, iy)
      const roll = hash(index)
      if (biome === FOREST && trees.length < 650) {
        const scale = 0.75 + hash(index + 3) * 0.85
        trees.push({
          x: point.x + (roll - 0.5) * 1.6,
          z: point.z + (hash(index + 1) - 0.5) * 1.6,
          sx: scale,
          sy: scale * (1.05 + hash(index + 5) * 0.4),
          sz: scale,
          rotation: roll * Math.PI * 2,
        })
      } else if (biome === ROCK && rocks.length < 240 && roll > 0.35) {
        const scale = 0.45 + hash(index + 4) * 0.7
        rocks.push({
          x: point.x,
          z: point.z,
          sx: scale,
          sy: scale * 0.7,
          sz: scale,
          rotation: roll * Math.PI,
        })
      }
    }
  }
  view.treeSpots = trees
  view.rockSpots = rocks
  writeInstances(view.trees, trees, field, (spot) => spot.sy * 0.95)
  writeInstances(view.rocks, rocks, field, (spot) => spot.sy * 0.45)
}

export function updatePropHeights(view, field) {
  writeInstances(view.trees, view.treeSpots, field, (spot) => spot.sy * 0.95)
  writeInstances(view.rocks, view.rockSpots, field, (spot) => spot.sy * 0.45)
}

export function moveBrush(view, point, radius) {
  view.ring.visible = true
  view.ring.position.set(point.x, Math.max(point.y, 0.18) + 0.18, point.z)
  view.ring.scale.set(radius, radius, 1)
}
