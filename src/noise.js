export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function smoothstep(edge0, edge1, value) {
  const span = edge1 - edge0
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, (value - edge0) / span))
  return t * t * (3 - 2 * t)
}

export function makeNoise(seed) {
  const rand = mulberry32(seed || 1)
  const size = 256
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand()

  return function noise(x, y) {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const wrap = (value) => ((value % size) + size) % size
    const at = (ix, iy) => grid[wrap(iy) * size + wrap(ix)]
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

export function fbm(noise, x, y) {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let weight = 0
  for (let octave = 0; octave < 5; octave += 1) {
    sum += amplitude * noise(x * frequency, y * frequency)
    weight += amplitude
    frequency *= 2
    amplitude *= 0.5
  }
  return sum / weight
}
