const API_URL = 'http://localhost:3000'

let startOffset = 0;
async function fetchApi(signal, writableStream) {
  const response = await fetch(API_URL, {
    signal,
    headers: {
      Range: `bytes=${startOffset}-`
    }
  })

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(parseNDJSON())
    .pipeTo(writableStream)
  return reader
}

function appendToHTML(element) {
  return new WritableStream({
    write({ name, hp, attack, defense, speed, img_url, type_1 }) {
      const card = `
      <section>
        <div class="pokemon ${type_1}">
          <h3 class="pokemon-name">${name}</h3>
          <div class="pokemon-info">
            <div class="pokemon-stats">
              <span class="stats-text">Hp: ${hp}</span>
              <span class="stats-text">Attack: ${attack}</span>
              <span class="stats-text">Defense: ${defense}</span>
              <span class="stats-text">Speed: ${speed}</span>
            </div>
            <div class="pokemon-img">
              <img src="${img_url}" alt="${name} image">
            </div>
          </div>
        </div>
      </section>
      `
      element.insertAdjacentHTML('beforeend', card)
    }
  })
}

function parseNDJSON() {
  let ndjsonBuffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      const jsonChunk = JSON.parse(chunk)
      const data = jsonChunk.data
      startOffset = jsonChunk.totalBytes
      console.log(startOffset)
      ndjsonBuffer += data
      const items = ndjsonBuffer.split('\n')
      items.slice(0, -1).forEach(item => controller.enqueue(JSON.parse(item)))

      ndjsonBuffer = items[items.length - 1]
    },
    flush(controller) {
      if (!ndjsonBuffer) return;
      controller.enqueue(JSON.parse(ndjsonBuffer))
    }
  })
}

const [cards, start, stop] = ['cards', 'start', 'stop'].map((item) => document.getElementById(item))

let abortController = new AbortController()
start.addEventListener('click', async () => {
  await fetchApi(abortController.signal, appendToHTML(cards))
})

stop.addEventListener('click', () => {
  abortController.abort()
  console.log('aborting...')
  abortController = new AbortController()
})