import { createReadStream, write } from "node:fs";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Readable, Transform, Writable } from "node:stream";
import csvtojson from 'csvtojson';

const PORT = 3000;

const createWritableStream = (res: ServerResponse<IncomingMessage> & {
  req: IncomingMessage;
}) => {
  const writeStream = new Writable({
    write(chunk, _, callback) {
      res.write(chunk)
      callback();
    },
    final(callback) {
      console.log('Close stream')
      res.end();
      callback();
    },
  })

  return writeStream;
}

const createTransformStream = () => {
  const transformStream = new Transform({
    transform(chunk, _, callback) {
      const data = JSON.parse(Buffer.from(chunk).toString().concat('\n'))
      const convertedData = {
        id: Number(data.id),
        name: data.name,
        type_1: data.type_1,
        type_2: data.type_2,
        img_url: data.img_url,
        hp: Number(data.hp),
        attack: Number(data.attack),
        defende: Number(data.defense),
        speed: Number(data.speed)
      }
      callback(null, JSON.stringify(convertedData))
    },
  })
  return transformStream;
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

  
  Readable.toWeb(createReadStream('../datasets/pokemons.csv'))
  .pipeThrough(Transform.toWeb(csvtojson()))
  .pipeThrough(Transform.toWeb(createTransformStream()))
  .pipeTo(Writable.toWeb(createWritableStream(res)))
  .catch((err) => {
    console.log(err.message)
  })

  res.writeHead(200, headers)
})
.listen(PORT)
.on('listening', () => console.log(`Server is running at: ${PORT}`))