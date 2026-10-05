import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { SEGMENTS, SIZE, cellPosition } from './terrain-math.js'

test('terrain cells match the rotated plane geometry', () => {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position

  const corner = cellPosition(0, 0)
  assert.ok(Math.abs(position.getX(0) - corner.x) < 1e-4)
  assert.ok(Math.abs(position.getZ(0) - corner.z) < 1e-4)

  const ix = 37
  const iy = 71
  const index = iy * (SEGMENTS + 1) + ix
  const cell = cellPosition(ix, iy)
  assert.ok(Math.abs(position.getX(index) - cell.x) < 1e-3)
  assert.ok(Math.abs(position.getZ(index) - cell.z) < 1e-3)
  assert.ok(Math.abs(position.getY(index)) < 1e-5)
})
