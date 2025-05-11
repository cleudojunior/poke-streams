# Poke-stream

This project is intended to learn how to create streams and how to use them in browsers. the project is basically 
read a csv file, parse the lines and send to the client. Using streams we can process chunks and send as we have them, 
we don't need to wait the entire file be readed. It saves our memory and allows it to server others users.

## Run the project

### Server
1. Go to `server` folder and run 

```sh
npm install
```

2. Run 
```sh
npm run start
```

### Ui

1. Go to `ui` folder and run

```sh
npm install
```

2. Run

```sh
npm run start
```

3. http-server package will open local hosts and show the links in the terminal.

### Creating pokemons csv file
You can generate the csv file running the python script

1. Go to `scripts/generate-dataset` folder

2. Enable python virtual environment

```sh
python -m venv venv
source venv/bin/activate
```

3. Install the dependencies

```sh
python -m pip install -r requirements.txt
```

4. Run the python code

```sh
python pokemons.py
```