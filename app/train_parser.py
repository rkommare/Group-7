"""Fine-tune BART-MNLI for Fern-Ware condition extraction."""

from pathlib import Path
import random

import pandas as pd
import torch
from datasets import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)


SEED = 42
ATTRIBUTES = ["watering", "humidity", "sunlight"]
VALUES = ["low", "medium", "high"]
MODEL_NAME = "facebook/bart-large-mnli"

ATTRIBUTE_CONFIG = {
    "watering": {
        "labels": {
            "low": "rare watering",
            "medium": "weekly watering",
            "high": "frequent watering",
        },
        "hypothesis": "The user's plant watering schedule is {}.",
    },
    "humidity": {
        "labels": {
            "low": "low humidity",
            "medium": "medium humidity",
            "high": "high humidity",
        },
        "hypothesis": "The room has {}.",
    },
    "sunlight": {
        "labels": {
            "low": "low sunlight",
            "medium": "medium sunlight",
            "high": "high sunlight",
        },
        "hypothesis": "The room has {}.",
    },
}

APP_DIR = Path(__file__).resolve().parent
DATA_PATH = APP_DIR / "dataset" / "data.csv"
OUTPUT_DIR = APP_DIR / "parser_finetuned"


def expand_to_nli(frame: pd.DataFrame) -> Dataset:
    premises = []
    hypotheses = []
    labels = []

    for _, row in frame.iterrows():
        for attribute in ATTRIBUTES:
            for value in VALUES:
                config = ATTRIBUTE_CONFIG[attribute]
                candidate_label = config["labels"][value]
                premises.append(row["text"])
                hypotheses.append(config["hypothesis"].format(candidate_label))
                labels.append(2 if row[attribute] == value else 0)

    return Dataset.from_dict(
        {
            "premise": premises,
            "hypothesis": hypotheses,
            "label": labels,
        }
    )


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATA_PATH}. Run create_dataset.py first."
        )

    raw = pd.read_csv(DATA_PATH)
    required_columns = {"text", *ATTRIBUTES}
    missing_columns = required_columns.difference(raw.columns)
    if missing_columns:
        raise ValueError(
            "Dataset is missing columns: " + ", ".join(sorted(missing_columns))
        )

    invalid_values = {
        value
        for attribute in ATTRIBUTES
        for value in raw[attribute].dropna().unique()
        if value not in VALUES
    }
    if invalid_values:
        raise ValueError(
            "Condition labels must be low, medium, or high. Invalid values: "
            + ", ".join(sorted(invalid_values))
        )

    # Split descriptions before NLI expansion so the same premise cannot leak
    # into both training and validation data.
    indices = list(range(len(raw)))
    random.Random(SEED).shuffle(indices)
    split_index = max(1, int(len(indices) * 0.8))
    train_frame = raw.iloc[indices[:split_index]].reset_index(drop=True)
    validation_frame = raw.iloc[indices[split_index:]].reset_index(drop=True)

    train_dataset = expand_to_nli(train_frame)
    validation_dataset = expand_to_nli(validation_frame)

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def tokenize(batch):
        return tokenizer(
            batch["premise"],
            batch["hypothesis"],
            truncation=True,
        )

    train_dataset = train_dataset.map(
        tokenize,
        batched=True,
        remove_columns=["premise", "hypothesis"],
    )
    validation_dataset = validation_dataset.map(
        tokenize,
        batched=True,
        remove_columns=["premise", "hypothesis"],
    )

    id2label = {0: "contradiction", 1: "neutral", 2: "entailment"}
    label2id = {label: index for index, label in id2label.items()}

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=3,
        id2label=id2label,
        label2id=label2id,
    )

    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    use_fp16 = torch.cuda.is_available() and not use_bf16

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=1,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=8,
        gradient_accumulation_steps=4,
        learning_rate=2e-5,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=1,
        load_best_model_at_end=True,
        bf16=use_bf16,
        fp16=use_fp16,
        seed=SEED,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
    )

    trainer.train()
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"Saved fine-tuned model to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
