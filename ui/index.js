const API_URL = 'http://localhost:3000'

let startOffset = 0;
let abortController = new AbortController()

async function fetchApi(signal, writableStream) {
  const response = await fetch(API_URL, {
    signal,
    headers: {
      Range: `bytes=${startOffset}-`
    }
  })

  response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(parseNDJSON())
    .pipeTo(writableStream, { signal: abortController.signal })
}

function appendToHTML(element) {
  return new WritableStream({
    write({ data, totalBytes }) {
      const { name, hp, attack, defense, speed, img_url, type_1 } = data
      startOffset = totalBytes

      const card = `
      <ul>
        <li>
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
        </li>
      </ul>
      `
      element.insertAdjacentHTML('beforeend', card)
    },
    abort() {
      console.log('Stream aborted')
      abortController = new AbortController()
    }
  })
}

function parseNDJSON() {
  let ndjsonBuffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      ndjsonBuffer += chunk
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

start.addEventListener('click', async () => {
  try {
    await fetchApi(abortController.signal, appendToHTML(cards))
  } catch (err) {
    console.log(err.name)
    if (err.name !== 'AbortError') throw err
  }
})

stop.addEventListener('click', () => {
  abortController.abort()
  console.log('aborting...')
})


window.addEventListener('scroll', async () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
    try {
      await fetchApi(abortController.signal, appendToHTML(cards))
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }
  }
});