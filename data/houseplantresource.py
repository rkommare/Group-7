import json
import re
import time
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright


BASE_URL = "https://www.houseplantresource.com/"
OUTPUT_FILE = "houseplantresource.json"

LIGHT_VALUES = [
    "Low Light",
    "Medium Light",
    "High Light",
    "Low/Medium Light",
    "Medium/High Light",
]

WATER_VALUES = [
    "Low Water",
    "Medium Water",
    "High Water",
    "Low/Medium Water",
    "Medium/High Water",
]

VALID_PLANT_TYPES = {
    "Genus",
    "Species",
    "Cultivar",
    "Hybrid",
}


def extract_known_value(text, label, possible_values):
    values = "|".join(
        re.escape(value)
        for value in sorted(
            possible_values,
            key=len,
            reverse=True,
        )
    )

    match = re.search(
        rf"\b{re.escape(label)}\s+({values})\b",
        text,
        flags=re.IGNORECASE,
    )

    return match.group(1) if match else None


def normalize_url(href):
    url = urljoin(BASE_URL, href)
    parsed = urlparse(url)

    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def save_plants(plants):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(
            plants,
            file,
            indent=2,
            ensure_ascii=False,
        )


def get_genus_links(page):
    page.goto(
        BASE_URL,
        wait_until="domcontentloaded",
        timeout=60_000,
    )

    page.get_by_role(
        "heading",
        name="Genus",
        exact=True,
    ).wait_for(
        state="visible",
        timeout=30_000,
    )

    links = {}

    anchors = page.locator("a")
    anchor_count = anchors.count()

    for index in range(anchor_count):
        anchor = anchors.nth(index)

        href = anchor.get_attribute("href")
        name = anchor.inner_text().strip()

        if not href or not name:
            continue

        url = normalize_url(href)

        if re.search(
            r"-[0-9a-f]{32}$",
            url,
            flags=re.IGNORECASE,
        ):
            links[url] = name

    return links


def wait_for_page_text(page, timeout_seconds=20):
    body = page.locator("body")

    body.wait_for(
        state="attached",
        timeout=15_000,
    )

    end_time = time.monotonic() + timeout_seconds
    normalized_text = ""

    while time.monotonic() < end_time:
        try:
            body_text = body.inner_text(timeout=5_000)
            normalized_text = re.sub(r"\s+", " ", body_text).strip()

            if re.search(
                r"\bTags\s+(Genus|Species|Cultivar|Hybrid)\b",
                normalized_text,
                flags=re.IGNORECASE,
            ):
                return normalized_text

        except Exception:
            pass

        page.wait_for_timeout(1_000)

    return normalized_text


def parse_plant_page(page, url, fallback_name):
    response = page.goto(
        url,
        wait_until="domcontentloaded",
        timeout=60_000,
    )


    normalized_text = wait_for_page_text(page)

    if not normalized_text:
        raise RuntimeError("No page text was loaded")

    heading_text = None
    heading = page.locator("h1").first

    try:
        heading_text = heading.text_content(timeout=5_000)
    except Exception:
        pass

    if heading_text:
        name = heading_text.strip()
    else:
        name = fallback_name

    tag_match = re.search(
        r"\bTags\s+(Genus|Species|Cultivar|Hybrid)\b",
        normalized_text,
        flags=re.IGNORECASE,
    )

    plant_type = tag_match.group(1) if tag_match else None

    return {
        "name": name,
        "type": plant_type,
        "light": extract_known_value(
            normalized_text,
            "Light",
            LIGHT_VALUES,
        ),
        "water": extract_known_value(
            normalized_text,
            "Water",
            WATER_VALUES,
        ),
        "source": url,
    }


def main():
    plants = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
        )

        context = browser.new_context()
        context.set_default_timeout(15_000)
        context.set_default_navigation_timeout(60_000)

        page = context.new_page()

        try:
            links = get_genus_links(page)

            print(
                f"Found {len(links)} pages",
                flush=True,
            )

            for index, (url, link_name) in enumerate(
                links.items(),
                start=1,
            ):
                plant = None
                last_error = None

                print(
                    f"Loading {index}/{len(links)}: {link_name}",
                    flush=True,
                )

                for attempt in range(1, 3):
                    try:
                        plant = parse_plant_page(
                            page,
                            url,
                            link_name,
                        )
                        break

                    except Exception as error:
                        last_error = error

                        print(
                            f"  Attempt {attempt}/2 failed: {error}",
                            flush=True,
                        )

                        try:
                            page.close()
                        except Exception:
                            pass

                        page = context.new_page()

                        if attempt < 2:
                            time.sleep(2)

                if plant is None:
                    print(
                        f"Could not parse {url}: {last_error}",
                        flush=True,
                    )
                    continue

                if plant["type"] not in VALID_PLANT_TYPES:
                    print(
                        f"{index}/{len(links)}: "
                        f"Skipped {link_name}; no plant type found",
                        flush=True,
                    )
                    continue

                plants.append(plant)
                save_plants(plants)

                print(
                    f"{index}/{len(links)}: "
                    f"{plant['name']} — "
                    f"{plant['light']}, "
                    f"{plant['water']}",
                    flush=True,
                )

                time.sleep(5) #5 works well, lower doesn't work

        finally:
            try:
                page.close()
            except Exception:
                pass

            context.close()
            browser.close()

    save_plants(plants)

    print(
        f"Saved {len(plants)} plants to {OUTPUT_FILE}",
        flush=True,
    )


if __name__ == "__main__":
    main()