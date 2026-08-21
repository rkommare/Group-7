from pathlib import Path
from typing import Any

import torch
from transformers import pipeline



MODEL_PATH = (
    Path(__file__).resolve().parent
    / "parser_finetuned"
    / "checkpoint-450"
)

ATTRIBUTE_CONFIG = {
    "watering": {
        "labels": ["rare watering", "weekly watering", "frequent watering"],
        "levels": {
            "rare watering": "low",
            "weekly watering": "medium",
            "frequent watering": "high",
        },
        "hypothesis": "The user's plant watering schedule is {}.",
    },
    "humidity": {
        "labels": ["low humidity", "medium humidity", "high humidity"],
        "levels": {
            "low humidity": "low",
            "medium humidity": "medium",
            "high humidity": "high",
        },
        "hypothesis": "The room has {}.",
    },
    "sunlight": {
        "labels": ["low sunlight", "medium sunlight", "high sunlight"],
        "levels": {
            "low sunlight": "low",
            "medium sunlight": "medium",
            "high sunlight": "high",
        },
        "hypothesis": "The room has {}.",
    },
}

_classifier = None


def get_classifier():
    """Load the model once, on the first API request."""
    global _classifier

    if _classifier is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Fine-tuned model directory not found: {MODEL_PATH}"
            )

        device = 0 if torch.cuda.is_available() else -1
        _classifier = pipeline(
            "zero-shot-classification",
            model=str(MODEL_PATH),
            tokenizer=str(MODEL_PATH),
            device=device,
        )

    return _classifier


def extract_conditions_ft(message: str) -> dict[str, dict[str, Any]]:
    """Return the selected level, score, and score margin per condition."""
    message = message.strip()
    if not message:
        raise ValueError("A non-empty message is required.")

    classifier = get_classifier()
    output: dict[str, dict[str, Any]] = {}

    for attribute, config in ATTRIBUTE_CONFIG.items():
        result = classifier(
            message,
            config["labels"],
            hypothesis_template=config["hypothesis"],
        )

        scores = [float(score) for score in result["scores"]]
        selected_label = result["labels"][0]
        margin = scores[0] - scores[1] if len(scores) > 1 else scores[0]

        output[attribute] = {
            "value": config["levels"][selected_label],
            "label": selected_label,
            "confidence": scores[0],
            "margin": margin,
            "scores": {
                label: score
                for label, score in zip(result["labels"], scores)
            },
        }

    return output


if __name__ == "__main__":
    example = (
        "My room is dry and shady, and I only want to water every few weeks."
    )
    print(extract_conditions_ft(example))