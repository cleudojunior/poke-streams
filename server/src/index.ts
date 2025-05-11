import { createReadStream, ReadStream } from "node:fs";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Writable } from "node:stream";
import { pipeline as pipelinePromise } from "node:stream/promises";

type HandleCsvHeaders = () => { get(): string[], set(keys: string[]): void }

const PORT = 3000;
let csvHeaders: string[] = [];

const handleCsvHeaders: HandleCsvHeaders = () => {
  return {
    get() {
      return csvHeaders
    },
    set(keys: string[]) {
      csvHeaders = keys
    }
  }
}

const extractValuesFromCsvLine = (line: string): string[] => {
  const values = line.split('\n').shift()?.split(',')
  if (!values || values.length === 0) {
    throw Error(`Csv header malformed: ${csvHeaders}`,)
  }
  return values
}

const createWritableStream = (
  res: ServerResponse<IncomingMessage> & { req: IncomingMessage },
  incrementItems: () => void,
) => {
  const writeStream = new Writable({
    async write(chunk, _, callback) {
      incrementItems()
      res.write(chunk)
      callback();
    },
    final(callback) {
      res.end();
      callback();
    },
  })

  return writeStream;
}

async function consumePokemons(
  start: number, 
  byteCounter: (bytes: number) => number,
  setHeaders: (keys: string[]) => void, 
  getHeaders: () => string[], 
  readable: ReadStream,
  writable: Writable,
  abortController: AbortController,
  
) {

  async function * lineSplitter (source: ReadStream) {
    let buffer = '';
    for await (const chunk of source) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        yield line.concat('\n')
      }
    }
  };

  async function * convertToJson (source: AsyncIterable<string>) {
    let isFirstLine = start === 0;
    for await (const line of source) {
      if (isFirstLine) {
      const csvHeaders = extractValuesFromCsvLine(line)
      setHeaders(csvHeaders);
      isFirstLine = false;
      byteCounter(line.length)
      continue
    }
  
      const mappedLine = extractValuesFromCsvLine(line)
      const objectData = getHeaders().map((key, index) => {
        return [key, mappedLine[index]]
      })
      yield JSON.stringify({
        data: Object.fromEntries(objectData),
        totalBytes: byteCounter(line.length)
      }).concat('\n');
    }
  };

  try {
    await pipelinePromise(
    readable,
    lineSplitter,
    convertToJson,
    writable,
    {
      signal: abortController.signal
    }
    )
  }
  catch (err) {
    if (err instanceof Error && 'code' in err) {
      switch (err.code) {
      case 'ABORT_ERR':
        console.log(err.message)
        break
      default:
        throw err
      }
    }
  }
}

createServer(async (req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Accept-Ranges': 'bytes'
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end();
    return;
  }

  const range = req.headers.range
  const CHUNK_SIZE = 3000;
  const start = range ? Number(range.split('=')[1].split('-')[0]) : 0
  const end = start + CHUNK_SIZE

  let items = 0;
  const incrementItems = () => items++;
  let consumedBytes = start;
  const byteCounter = (bytes: number) => consumedBytes += bytes;

  const abortController = new AbortController()
  const handleCsvHeadersInstance = handleCsvHeaders()

  req.once('close', () => {
    console.log(`Connection closed: items: ${items}, readedBytes: ${consumedBytes}`)
    abortController.abort()
  });

  const filename = '../datasets/pokemons.csv';
  
  const readable = createReadStream(filename, { start, end });
  const writable = createWritableStream(res, incrementItems)

  consumePokemons(
    start,
    byteCounter,
    handleCsvHeadersInstance.set, 
    handleCsvHeadersInstance.get, 
    readable,
    writable,
    abortController,
  )

  res.writeHead(200, headers)
})
.listen(PORT, () => console.log(`Server is running at: ${PORT}`))