import csv
import re
from bs4 import BeautifulSoup, Tag

INPUT_FILE = "html/myindoorflora.html"
OUTPUT_FILE = "myindoorflora.csv"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

rows = []

#Find start of every new plant
for h3 in soup.find_all("h3", class_="wp-block-heading"):
    plant = {}
    heading_text = h3.get_text(" ", strip=True)

    match = re.match(r"^(.*?)\s*\((.*?)\)\s*$", heading_text)
    if match:
        plant["Common Name"] = match.group(1).strip()
        plant["Scientific Name"] = match.group(2).strip()

    description = ""
    traits = {}

    # Find traits and description of plant
    for sibling in h3.find_next_siblings():
        #Break if new plant starting
        if isinstance(sibling, Tag) and sibling.name == "h3":
            break

        if isinstance(sibling, Tag) and sibling.name == "p" and not description:
            description = sibling.get_text(" ", strip=True)

        if isinstance(sibling, Tag) and sibling.name == "ul":
            for li in sibling.find_all("li"):
                text = li.get_text(" ", strip=True)
                if ":" in text:
                    key, value = text.split(":", 1)
                    traits[key.strip()] = value.strip()
            break
    plant["Description"] = description

    plant.update(traits)
    rows.append(plant)

# Add csv header columns
fieldnames = []
for row in rows:
    for key in row.keys():
        if key not in fieldnames:
            fieldnames.append(key)
#Write to csv
with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(OUTPUT_FILE, " created")