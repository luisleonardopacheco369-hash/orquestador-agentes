import { REGIONS } from './interpret.js'
import { fbm, makeNoise, smoothstep } from './noise.js'

export const SIZE = 60
export const SEGMENTS = 100

export const GRASS = 0
export const SAND = 1
export const ROCK = 2
export const SNOW = 3
export const FOREST = 4
export const WATER = 5

const MIN_HEIGHT = -6
const MAX_HEIGHT = 14

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function cellPosition(ix, iy) {
  return {
    x: (ix / SEGMENTS - 0.5) * SIZE,
    z: (iy / SEGMENTS - 0.5) * SIZE,
  }
}

export function createField(seed = 1, style = 'land') {
  const res = SEGMENTS + 1
  const field = {
    heights: new Float32Array(res * res),
    biomes: new Uint8Array(res * res),
    res,
    seed,
    style,
  }
  fillGenerated(field, seed, style)
  return field
}

export function cloneField(field) {
  return {
    heights: field.heights.slice(),
    biomes: field.biomes.slice(),
    res: field.res,
    seed: field.seed,
    style: field.style,
  }
}

export function copyField(field, source) {
  field.heights.set(source.heights)
  field.biomes.set(source.biomes)
  field.seed = source.seed
  field.style = source.style
}

export function blendFields(field, base, target, amount) {
  const t = clamp(amount, 0, 1)
  for (let i = 0; i < field.heights.length; i += 1) {
    field.heights[i] = base.heights[i] + (target.heights[i] - base.heights[i]) * t
    field.biomes[i] = t > 0.55 ? target.biomes[i] : base.biomes[i]
  }
}

function biomeForHeight(height) {
  if (height < 0.08) return WATER
  if (height < 0.85) return SAND
  if (height > 7.4) return SNOW
  if (height > 4.8) return ROCK
  return GRASS
}

export function fillGenerated(field, seed, style = 'land') {
  const noise = makeNoise(seed)
  const offsetX = (seed % 997) * 0.17
  const offsetY = (seed % 577) * 0.21
  const res = field.res
  for (let iy = 0; iy < res; iy += 1) {
    for (let ix = 0; ix < res; ix += 1) {
      const u = ix / SEGMENTS
      const v = iy / SEGMENTS
      const base = fbm(noise, u * 2.6 + offsetX, v * 2.6 + offsetY)
      const ridgeNoise = fbm(noise, u * 1.35 + 8 + offsetX, v * 1.35 + offsetY)
      const ridge = 1 - Math.abs(ridgeNoise * 2 - 1)
      const dist = Math.hypot(u - 0.5, v - 0.5)
      const coast = smoothstep(style === 'island' ? 0.18 : 0.4, style === 'island' ? 0.46 : 0.58, dist)
      let height = (base - 0.46) * 9
      height += ridge * ridge * 6.5 * (1 - coast)
      height = height * (1 - coast * 0.35) - coast * (style === 'island' ? 5 : 3.2)
      height = clamp(height, MIN_HEIGHT, MAX_HEIGHT)
      const index = iy * res + ix
      field.heights[index] = height
      let biome = biomeForHeight(height)
      if (biome === GRASS && fbm(noise, u * 5.5 + 20, v * 5.5 + 4) > 0.6) biome = FOREST
      field.biomes[index] = biome
    }
  }
  field.seed = seed
  field.style = style
}

function mutateCell(heights, biomes, index, op, weight) {
  let height = heights[index]
  switch (op) {
    case 'raise':
      height = clamp(height + 4 * weight, MIN_HEIGHT, MAX_HEIGHT)
      if (height > 7) biomes[index] = SNOW
      else if (height > 4.6) biomes[index] = ROCK
      else if (biomes[index] === WATER && height > 0.25) biomes[index] = GRASS
      break
    case 'lower':
      height = clamp(height - 4 * weight, MIN_HEIGHT, MAX_HEIGHT)
      if (height < 0.08) biomes[index] = WATER
      else if (height < 0.9) biomes[index] = SAND
      break
    case 'water':
      height = clamp(height + (-1.7 - height) * Math.min(1, weight * 1.2), MIN_HEIGHT, MAX_HEIGHT)
      if (weight > 0.42) biomes[index] = WATER
      break
    case 'forest':
      if (weight > 0.4 && height > 0.08) biomes[index] = FOREST
      break
    case 'sand':
      height = clamp(height + (0.6 - height) * Math.min(1, weight * 0.9), MIN_HEIGHT, MAX_HEIGHT)
      if (weight > 0.35) biomes[index] = SAND
      break
    case 'snow':
      height = clamp(height + 1.5 * weight, MIN_HEIGHT, MAX_HEIGHT)
      if (weight > 0.4) biomes[index] = SNOW
      break
    case 'rock':
      height = clamp(height + 1.7 * weight, MIN_HEIGHT, MAX_HEIGHT)
      if (weight > 0.4) biomes[index] = ROCK
      break
    default:
      break
  }
  heights[index] = height
}

export function stamp(field, x, z, op, radius, power) {
  const res = field.res
  const cellRadius = Math.ceil((radius / SIZE) * SEGMENTS) + 1
  const centerX = (x / SIZE + 0.5) * SEGMENTS
  const centerY = (z / SIZE + 0.5) * SEGMENTS
  const ix0 = Math.max(0, Math.floor(centerX - cellRadius))
  const ix1 = Math.min(SEGMENTS, Math.ceil(centerX + cellRadius))
  const iy0 = Math.max(0, Math.floor(centerY - cellRadius))
  const iy1 = Math.min(SEGMENTS, Math.ceil(centerY + cellRadius))
  for (let iy = iy0; iy <= iy1; iy += 1) {
    for (let ix = ix0; ix <= ix1; ix += 1) {
      const point = cellPosition(ix, iy)
      const distance = Math.hypot(point.x - x, point.z - z)
      if (distance > radius) continue
      const falloff = Math.cos((distance / radius) * Math.PI * 0.5) ** 2
      mutateCell(field.heights, field.biomes, iy * res + ix, op, falloff * power)
    }
  }
}

function regionFalloff(u, v, region) {
  const dx = (u - region.x) / region.rx
  const dy = (v - region.y) / region.ry
  const distance = Math.hypot(dx, dy)
  if (region.ring) {
    const band = Math.abs(distance - 1)
    return band < 0.28 ? 1 - band / 0.28 : 0
  }
  if (distance >= 1) return 0
  return Math.cos(distance * Math.PI * 0.5) ** 2
}

export function regionCenter(regionKey) {
  const region = REGIONS[regionKey] || REGIONS.centro
  return cellPosition(region.x * SEGMENTS, region.y * SEGMENTS)
}

export function applyRegion(field, op, regionKey, power) {
  const region = REGIONS[regionKey] || REGIONS.centro
  const res = field.res
  if (op === 'smooth') {
    smoothRegion(field, region, power)
    return regionCenter(regionKey)
  }
  for (let iy = 0; iy < res; iy += 1) {
    for (let ix = 0; ix < res; ix += 1) {
      const weight = regionFalloff(ix / SEGMENTS, iy / SEGMENTS, region) * power
      if (weight <= 0) continue
      mutateCell(field.heights, field.biomes, iy * res + ix, op, weight)
    }
  }
  return regionCenter(regionKey)
}

function smoothRegion(field, region, power) {
  const res = field.res
  const original = field.heights.slice()
  for (let iy = 0; iy < res; iy += 1) {
    for (let ix = 0; ix < res; ix += 1) {
      const falloff = regionFalloff(ix / SEGMENTS, iy / SEGMENTS, region)
      if (falloff <= 0) continue
      let total = 0
      let count = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sx = Math.min(SEGMENTS, Math.max(0, ix + ox))
          const sy = Math.min(SEGMENTS, Math.max(0, iy + oy))
          total += original[sy * res + sx]
          count += 1
        }
      }
      const index = iy * res + ix
      const average = total / count
      field.heights[index] = original[index] + (average - original[index]) * Math.min(1, falloff * power)
    }
  }
}

export function smoothBrush(field, x, z, radius, power) {
  const res = field.res
  const original = field.heights.slice()
  const cellRadius = Math.ceil((radius / SIZE) * SEGMENTS) + 1
  const centerX = (x / SIZE + 0.5) * SEGMENTS
  const centerY = (z / SIZE + 0.5) * SEGMENTS
  const ix0 = Math.max(0, Math.floor(centerX - cellRadius))
  const ix1 = Math.min(SEGMENTS, Math.ceil(centerX + cellRadius))
  const iy0 = Math.max(0, Math.floor(centerY - cellRadius))
  const iy1 = Math.min(SEGMENTS, Math.ceil(centerY + cellRadius))
  for (let iy = iy0; iy <= iy1; iy += 1) {
    for (let ix = ix0; ix <= ix1; ix += 1) {
      const point = cellPosition(ix, iy)
      const distance = Math.hypot(point.x - x, point.z - z)
      if (distance > radius) continue
      const falloff = Math.cos((distance / radius) * Math.PI * 0.5) ** 2
      let total = 0
      let count = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sx = Math.min(SEGMENTS, Math.max(0, ix + ox))
          const sy = Math.min(SEGMENTS, Math.max(0, iy + oy))
          total += original[sy * res + sx]
          count += 1
        }
      }
      const index = iy * res + ix
      const average = total / count
      field.heights[index] = original[index] + (average - original[index]) * Math.min(1, falloff * power * 3)
    }
  }
}

export function carveRiver(field, power) {
  const points = []
  const steps = 96
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    points.push({
      x: Math.sin(t * Math.PI * 2) * SIZE * 0.15,
      z: (t - 0.5) * SIZE * 0.9,
    })
  }
  for (const point of points) stamp(field, point.x, point.z, 'sand', 6.2, power)
  for (const point of points) stamp(field, point.x, point.z, 'water', 3.1, power)
  return { x: 0, z: 0 }
}

export function applyPlan(field, plan, power = 1) {
  if (plan.intent === 'generate') {
    const seed = plan.seed ?? field.seed + 1
    fillGenerated(field, seed, plan.style || 'land')
    return findStand(field)
  }
  if (plan.world?.op === 'river') return carveRiver(field, power)
  return applyRegion(field, plan.world.op, plan.world.region, power)
}

export function heightAt(field, x, z) {
  const gx = (x / SIZE + 0.5) * SEGMENTS
  const gz = (z / SIZE + 0.5) * SEGMENTS
  const ix = Math.floor(gx)
  const iy = Math.floor(gz)
  if (ix < 0 || iy < 0 || ix >= SEGMENTS || iy >= SEGMENTS) return 0
  const tx = gx - ix
  const ty = gz - iy
  const res = field.res
  const h00 = field.heights[iy * res + ix]
  const h10 = field.heights[iy * res + ix + 1]
  const h01 = field.heights[(iy + 1) * res + ix]
  const h11 = field.heights[(iy + 1) * res + ix + 1]
  return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty
}

export function findStand(field) {
  const res = field.res
  let best = { x: 0, z: 0, height: 1 }
  let bestScore = -Infinity
  for (let iy = 1; iy < res - 1; iy += 2) {
    for (let ix = 1; ix < res - 1; ix += 2) {
      const height = field.heights[iy * res + ix]
      if (height < 0.45 || height > 4) continue
      const point = cellPosition(ix, iy)
      const centrality = 1 - Math.hypot(point.x, point.z) / (SIZE * 0.55)
      const score = centrality * 2 + Math.min(height, 2.2)
      if (score > bestScore) {
        bestScore = score
        best = { x: point.x, z: point.z, height }
      }
    }
  }
  return best
}

export function countBiome(field, biome) {
  let count = 0
  for (let i = 0; i < field.biomes.length; i += 1) {
    if (field.biomes[i] === biome) count += 1
  }
  return count
}

export function heightRange(field) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < field.heights.length; i += 1) {
    min = Math.min(min, field.heights[i])
    max = Math.max(max, field.heights[i])
  }
  return { min, max }
}
