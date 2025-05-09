import requests
import pandas as pd

def get_all_pokemon_data():
    pokemon_data = []
    url = "https://pokeapi.co/api/v2/pokemon?limit=10000"
    response = requests.get(url)
    
    if response.status_code != 200:
        print("Error accessing PokéAPI")
        return pokemon_data

    pokemon_list = response.json()["results"]
    
    for pokemon in pokemon_list:
        pokemon_response = requests.get(pokemon["url"])
        if pokemon_response.status_code == 200:
            data = pokemon_response.json()
            pokemon_info = {
                "id": data["id"],
                "name": data["name"],
                "type_1": data["types"][0]["type"]["name"],
                "type_2": data["types"][1]["type"]["name"] if len(data["types"]) > 1 else "",
                "img_url": data["sprites"]["front_default"],
                "hp": data["stats"][0]["base_stat"],
                "attack": data["stats"][1]["base_stat"],
                "defense": data["stats"][2]["base_stat"],
                "speed": data["stats"][5]["base_stat"]
            }
            pokemon_data.append(pokemon_info)
            print(f"Collected: {data['name']}")
        else:
            print(f"Error collecting data from {pokemon['name']}")

    return pokemon_data

def save_to_csv(pokemon_data):
    df = pd.DataFrame(pokemon_data)
    df = df[["id", "name", "type_1", "type_2", "img_url", "hp", "attack", "defense", "speed"]]
    df.to_csv("../../datasets/pokemons.csv", index=False)
    print("CSV generated succesfully")

if __name__ == "__main__":
    pokemon_data = get_all_pokemon_data()
    save_to_csv(pokemon_data)