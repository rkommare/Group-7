import json
import re
import unicodedata

import pandas as pd


JSON_FILE = "genus.json"
CSV_FILE = "myindoorflora(1).csv"
OUTPUT_FILE = "genus_with_descriptions.json"


def normalize_name(value):
    """
    Converts names such as:
    'Bird of Paradise' -> 'bird_of_paradise'
    'Fiddle-Leaf Fig'  -> 'fiddle_leaf_fig'
    """
    value = str(value).strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(
        character
        for character in value
        if not unicodedata.combining(character)
    )
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


# Names in genus.json that use a different name than the CSV.
ALIASES = {
    "alocasia": "elephant_ear",
    "aralia": "fatsia_japonica",
    "dieffenbachia": "dumb_cane",
    "epiphyllum": "orchid_cactus",
    "gerbera": "gerbera_daisy",
    "hypoestes": "polka_dot_plant",
    "ivy": "english_ivy",
    "lipstick": "lipstick_plant",
    "monstera": "monstera_deliciosa",
    "pilea": "pilea_peperomioides",
    "scindapsus": "silver_pothos",
    "syngonium": "arrowhead_plant",
    "tillandsia": "air_plants",
    "tradescantia": "spiderwort",
    "zamioculcas_zamiifolia": "zz_plant",
}


# Load genus.json.
with open(JSON_FILE, "r", encoding="utf-8") as file:
    genus_data = json.load(file)


# Load the CSV.
plant_data = pd.read_csv(CSV_FILE)


# Create a lookup table
description_lookup = {}

for _, row in plant_data.iterrows():
    common_name = row.get("Common Name")
    description = row.get("Description")

    if pd.isna(common_name) or pd.isna(description):
        continue


    if normalized_name not in description_lookup:
        description_lookup[normalized_name] = str(description).strip()


matched = []
unmatched = []


#Add a description field to each genus object.
for plant in genus_data:
    genus_name = plant["genus"]
    normalized_genus = normalize_name(genus_name)


    lookup_name = normalized_genus

    if lookup_name not in description_lookup:
        lookup_name = ALIASES.get(normalized_genus)

    if lookup_name in description_lookup:
        plant["description"] = description_lookup[lookup_name]
        matched.append(genus_name)
    else:
        plant["description"] = None
        unmatched.append(genus_name)


with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
    json.dump(genus_data, file, indent=2, ensure_ascii=False)


print(f"Saved updated data to: {OUTPUT_FILE}")
print(f"Descriptions matched: {len(matched)}")
print(f"Descriptions not found: {len(unmatched)}")

if unmatched:
    print("\nUnmatched genus names:")
    for genus_name in unmatched:
        print(f"- {genus_name}")