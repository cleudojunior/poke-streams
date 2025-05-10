import { createReadStream, promises } from "node:fs";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Readable, Transform, Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";

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

const createLineSplitter = () => {
  let buffer = '';
  return new Transform({
    transform(chunk, _, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''
      for (const line of lines) {
        this.push(line.concat('\n'))
      } 
      callback()
    },
    flush(callback) {
      if (buffer) this.push(buffer.concat('\n'));
      callback()
    }
  });
};

const extractValuesFromCsvLine = (line: string): string[] => {
  const values = line.split('\n').shift()?.split(',')
  if (!values || values.length === 0) {
    throw Error(`Csv header malformed: ${csvHeaders}`,)
  }
  return values
}

const createTransformStream = (setHeaders: (keys: string[]) => void, getHeaders: () => string[], byteCounter: (bytes: number) => number, offset: number) => {
  let isFirstLine = offset === 0;
  const transformStream = new Transform({
    transform(chunk: Buffer, _, callback) {
      if (isFirstLine) {
        const csvHeaders = extractValuesFromCsvLine(chunk.toString())
        setHeaders(csvHeaders);
        isFirstLine = false;
        byteCounter(chunk.length)
        return callback()
      }

      const line = chunk.toString()
      const mappedLine = extractValuesFromCsvLine(line)
      const objectData = getHeaders().map((key, index) => {
        return [key, mappedLine[index]]
      })
      const convertedData = JSON.stringify(Object.fromEntries(objectData)).concat('\n');
      this.push(JSON.stringify({
        data: convertedData,
        totalBytes: byteCounter(chunk.length)
      }));
      callback();
    },
  })
  return transformStream;
}

const createWritableStream = (res: ServerResponse<IncomingMessage> & {
  req: IncomingMessage;
},
signal: AbortSignal,
incrementItems: () => void,
) => {
  const writeStream = new Writable({
    async write(chunk, _, callback) {
      await setTimeout(200)
      incrementItems()
      res.write(chunk)
      callback();
    },
    final(callback) {
      res.end();
      callback();
    },
    signal
  })

  return writeStream;
}

createServer(async (req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*'
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end();
    return;
  }

  const rangeStart = Number(req.headers.range?.split('=')[1].split('-')[0])
  const offset = rangeStart ?? 0;

  let items = 0;
  let consumedBytes = offset;
  const incrementItems = () => items++;
  const byteCounter = (bytes: number) => consumedBytes += bytes;
  const abortController = new AbortController()
  const handleCsvHeadersInstance = handleCsvHeaders()

  req.once('close', () => {
    console.log(`Connection closed: items: ${items}, readedBytes: ${consumedBytes}`)
    abortController.abort()
    items = 0;
  });

  Readable.toWeb(createReadStream('../datasets/pokemons.csv', {
    start: offset,
  }))
  .pipeThrough(Transform.toWeb(createLineSplitter()))
  .pipeThrough(Transform.toWeb(createTransformStream(handleCsvHeadersInstance.set, handleCsvHeadersInstance.get, byteCounter, offset)))
  .pipeTo(Writable.toWeb(createWritableStream(res, abortController.signal, incrementItems)))
  .catch((err) => {
    if (err.name !== 'AbortError') throw err
    console.log(err.message)
  })

  res.writeHead(200, headers)
})
.listen(PORT, () => console.log(`Server is running at: ${PORT}`))