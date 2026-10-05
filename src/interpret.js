export const REGIONS = {
  centro: { x: 0.5, y: 0.5, rx: 0.22, ry: 0.22 },
  norte: { x: 0.5, y: 0.24, rx: 0.36, ry: 0.2 },
  sur: { x: 0.5, y: 0.76, rx: 0.36, ry: 0.2 },
  este: { x: 0.78, y: 0.5, rx: 0.2, ry: 0.36 },
  oeste: { x: 0.22, y: 0.5, rx: 0.2, ry: 0.36 },
  alrededor: { x: 0.5, y: 0.5, rx: 0.48, ry: 0.48, ring: true },
  todo: { x: 0.5, y: 0.5, rx: 0.78, ry: 0.78 },
}

const REGION_PHRASE = {
  centro: 'en el centro',
  norte: 'al norte',
  sur: 'al sur',
  este: 'al este',
  oeste: 'al oeste',
  alrededor: 'alrededor',
  todo: 'en todo el mapa',
}

const COLORS = {
  dorado: '#e2a23a',
  dorada: '#e2a23a',
  azul: '#3c7ea8',
  verde: '#3f8f62',
  roja: '#c44b3c',
  rojo: '#c44b3c',
  blanca: '#f4efe6',
  blanco: '#f4efe6',
  violeta: '#7a5ea8',
  naranja: '#e07a3d',
  arcilla: '#d86b45',
  negra: '#2b2926',
  negro: '#2b2926',
}

const HELP =
  'Puedo abrir lagos, levantar montañas, sembrar bosques o cambiar mi forma. Prueba «un lago en el centro» o «hazte dorada».'

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findRegion(text) {
  if (/(todo el|toda la|por todas|mapa entero|en todo|todo el mapa)/.test(text)) return 'todo'
  if (/(alrededor|rodeando|en circulo|circular)/.test(text)) return 'alrededor'
  if (/\bnorte\b/.test(text)) return 'norte'
  if (/\bsur\b/.test(text)) return 'sur'
  if (/\boeste\b/.test(text)) return 'oeste'
  if (/(?:al|del|en el|hacia el|el)\s+este\b/.test(text)) return 'este'
  if (/\bcentro\b|\bmedio\b/.test(text)) return 'centro'
  return 'centro'
}

function agentChanges(text) {
  const agent = {}
  const colorName = Object.keys(COLORS).find((name) => new RegExp(`\\b${name}\\b`).test(text))
  if (colorName) agent.color = COLORS[colorName]
  if (/(mas alta|mas alto|crece|hazte grande|mas grande|alargate)/.test(text)) agent.heightDelta = 0.28
  if (/(mas pequena|mas pequeno|mas baja|mas bajo|encoge|hazte pequena|achicate)/.test(text)) {
    agent.heightDelta = -0.28
  }
  if (/(mas ancha|mas ancho|mas redonda|mas redondo|ensanchar)/.test(text)) agent.widthDelta = 0.22
  if (/(mas delgada|mas delgado|mas flaca|mas estrecha|mas estrecho)/.test(text)) agent.widthDelta = -0.22
  return agent
}

function mold(op, text, speech) {
  const region = findRegion(text)
  return {
    intent: 'mold',
    speech: speech(REGION_PHRASE[region]),
    world: { op, region },
  }
}

export function interpret(raw) {
  const text = normalize(raw || '')
  if (!text) return { intent: 'help', speech: HELP }

  if (/(ayuda|que puedes|como te uso|ejemplos)/.test(text)) {
    return { intent: 'help', speech: HELP }
  }

  if (/(verte|muestrate|acercate|ven aqui|donde estas|mirame)/.test(text)) {
    return { intent: 'look', speech: 'Aquí estoy. Acércate: puedes cambiar mi altura, mi ancho y mi color.' }
  }

  const mentionsSelf = /(hazte|ponte|cambiate|tu forma|tu color|moldearte|quiero moldearte)/.test(text)
  const agent = agentChanges(text)
  const hasAgentChange = agent.color || agent.heightDelta || agent.widthDelta
  if (mentionsSelf || (hasAgentChange && !/(lago|agua|mar|montana|valle|bosque|arbol|desierto|arena|nieve|roca|rio|isla|mundo)/.test(text))) {
    if (!hasAgentChange) {
      return { intent: 'help', speech: 'Dime cómo moldearme: más alta, más ancha, o un color como dorada o azul.' }
    }
    const bits = []
    if (agent.heightDelta > 0) bits.push('más alta')
    if (agent.heightDelta < 0) bits.push('más baja')
    if (agent.widthDelta > 0) bits.push('más ancha')
    if (agent.widthDelta < 0) bits.push('más delgada')
    if (agent.color) bits.push('de otro color')
    return { intent: 'agent', speech: `Me moldeo ${bits.join(' y ')}.`, agent }
  }

  if (/\bisla\b|\barcipielago\b/.test(text)) {
    return {
      intent: 'generate',
      style: 'island',
      speech: 'Levanto una isla y dejo que el agua la rodee.',
    }
  }

  if (/(nuevo mundo|crea un mundo|crear un mundo|regenera|otro mundo|reinicia|empieza de nuevo|mundo nuevo)/.test(text)) {
    return {
      intent: 'generate',
      style: 'land',
      speech: 'Abro otro mundo. Recórrelo y cámbialo: sigue siendo barro bajo tus manos.',
    }
  }

  if (/(alisa|suaviza|aplana)/.test(text)) {
    return mold('smooth', text, (where) => `Aliso el terreno ${where}.`)
  }

  if (/\brio\b|\brios\b/.test(text)) {
    return {
      intent: 'mold',
      speech: 'Abro un cauce y dejo que el agua lo recorra.',
      world: { op: 'river', region: 'todo' },
    }
  }

  if (/\bmar\b|\boceano\b/.test(text)) {
    return mold('water', text.replace(/\bmar\b|\boceano\b/g, 'todo el mapa'), (where) => `Dejo entrar el agua ${where}.`)
  }

  if (/(lago|laguna|agua|charca|estanque)/.test(text)) {
    return mold('water', text, (where) => `Hundo la tierra ${where} hasta que el agua encuentre sitio.`)
  }

  if (/(bosque|arboles|selva|arboleda)/.test(text)) {
    return mold('forest', text, (where) => `Siembro un bosque ${where}.`)
  }

  if (/(desierto|arena|playa|dunas)/.test(text)) {
    return mold('sand', text, (where) => `Extiendo arena ${where}.`)
  }

  if (/(nieve|nevado|invierno|cumbres)/.test(text)) {
    return mold('snow', text, (where) => `Cubro de nieve ${where}.`)
  }

  if (/(roca|piedra|risco|acantilado)/.test(text)) {
    return mold('rock', text, (where) => `Saco roca ${where}.`)
  }

  if (/(valle|hunde|hundir|depresion|hondonada|baja el)/.test(text)) {
    return mold('lower', text, (where) => `Hundo un valle ${where}.`)
  }

  if (/(montana|monte|pico|eleva|levanta|cerro|mas alto)/.test(text)) {
    return mold('raise', text, (where) => `Levanto montañas ${where}.`)
  }

  return { intent: 'help', speech: HELP }
}
