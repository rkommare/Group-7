from pathlib import Path
import sys

from flask import (
    Flask,
    jsonify,
    redirect,
    request,
    send_from_directory
)


ROOT_DIR = Path(__file__).resolve().parent
APP_DIR = ROOT_DIR / "app"
DATA_DIR = ROOT_DIR / "data"

sys.path.insert(0, str(APP_DIR))

from parse_message_finetuned import (
    extract_conditions_ft,
    get_classifier,
)


app = Flask(__name__)


@app.get("/")
def home():
    return redirect("/app/index.html")


@app.get("/app/<path:filename>")
def app_files(filename):
    return send_from_directory(APP_DIR, filename)


@app.get("/data/<path:filename>")
def data_files(filename):
    return send_from_directory(DATA_DIR, filename)


@app.post("/api/parse")
def parse_message():
    body = request.get_json(silent=True) or {}
    message = str(body.get("message", "")).strip()

    if not message:
        return jsonify({
            "error": "A non-empty message is required."
        }), 400

    try:
        predictions = extract_conditions_ft(message)
    except Exception as error:
        app.logger.exception("Condition parsing failed")

        return jsonify({
            "error": str(error)
        }), 500

    return jsonify({
        "water": predictions["watering"]["value"],
        "waterConfidence":
            predictions["watering"]["confidence"],
        "waterMargin":
            predictions["watering"]["margin"],

        "humidity": predictions["humidity"]["value"],
        "humidityConfidence":
            predictions["humidity"]["confidence"],
        "humidityMargin":
            predictions["humidity"]["margin"],

        "sun": predictions["sunlight"]["value"],
        "sunConfidence":
            predictions["sunlight"]["confidence"],
        "sunMargin":
            predictions["sunlight"]["margin"],

        "details": predictions
    })


if __name__ == "__main__":
    print("Loading the fine-tuned parser...")
    get_classifier()
    print("Parser loaded. Starting Fern-Ware...")
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=True,
        use_reloader=False
    )