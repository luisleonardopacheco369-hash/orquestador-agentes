import assert from 'node:assert/strict'
import test from 'node:test'
import { interpret } from './interpret.js'
import {
  SIZE,
  WATER,
  applyPlan,
  blendFields,
  cellPosition,
  cloneField,
  copyField,
  countBiome,
  createField,
  heightAt,
  heightRange,
  stamp,
} from './terrain-math.js'

test('the same seed builds the same world', () => {
  const first = createField(7, 'land')
  const second = createField(7, 'land')
  assert.equal(first.heights[0], second.heights[0])
  assert.equal(first.heights[4000], second.heights[4000])
  assert.notEqual(createField(8).heights[4000], first.heights[4000])
})

test('a generated world has coast, peaks, and forest or grass', () => {
  const field = createField(7, 'land')
  const range = heightRange(field)
  assert.ok(range.min < -0.4, `expected coast below zero, got ${range.min}`)
  assert.ok(range.max > 4, `expected peaks, got ${range.max}`)
  assert.ok(countBiome(field, WATER) > 30)
  assert.ok(countBiome(field, WATER) < field.heights.length * 0.45)
})

test('an island keeps the center above the surrounding water', () => {
  const field = createField(11, 'island')
  assert.ok(heightAt(field, 0, 0) > heightAt(field, 28, 0))
})

test('stamping a raise grows a hill', () => {
  const field = createField(3)
  const before = heightAt(field, 0, 0)
  stamp(field, 0, 0, 'raise', 5, 1)
  assert.ok(heightAt(field, 0, 0) > before + 1)
})

test('a lake request sinks the center under water', () => {
  const field = createField(5)
  const plan = interpret('un lago en el centro')
  applyPlan(field, plan, 1)
  assert.equal(plan.world.op, 'water')
  assert.equal(plan.world.region, 'centro')
  assert.ok(heightAt(field, 0, 0) < 0)
  assert.equal(field.biomes[50 * field.res + 50], WATER)
})

test('north mountains stay in the north', () => {
  const field = createField(4)
  const beforeNorth = heightAt(field, 0, -18)
  const beforeSouth = heightAt(field, 0, 18)
  applyPlan(field, interpret('montañas al norte'), 1)
  assert.ok(heightAt(field, 0, -18) > beforeNorth + 0.8)
  assert.ok(Math.abs(heightAt(field, 0, 18) - beforeSouth) < 0.35)
})

test('a river cuts a channel through dry land', () => {
  const field = createField(9)
  const before = heightAt(field, 0, 0)
  assert.ok(before > 1)
  applyPlan(field, interpret('abre un río'), 1)
  assert.ok(heightAt(field, 0, 0) < -1)
  const z = 12
  const t = z / (SIZE * 0.9) + 0.5
  const x = Math.sin(t * Math.PI * 2) * SIZE * 0.15
  assert.ok(heightAt(field, x, z) < -1)
  assert.equal(field.biomes[50 * field.res + 50], WATER)
})

test('blend restores both ends of a mold', () => {
  const field = createField(2)
  const base = cloneField(field)
  applyPlan(field, interpret('un valle en el centro'), 1)
  const target = cloneField(field)
  copyField(field, base)
  blendFields(field, base, target, 0)
  assert.equal(field.heights[20], base.heights[20])
  blendFields(field, base, target, 1)
  assert.equal(field.heights[20], target.heights[20])
})

test('cell 0 is the north-west corner', () => {
  const corner = cellPosition(0, 0)
  assert.ok(corner.x < 0)
  assert.ok(corner.z < 0)
  const center = cellPosition(50, 50)
  assert.ok(Math.abs(center.x) < 1e-6)
  assert.ok(Math.abs(center.z) < 1e-6)
})
