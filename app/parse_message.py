from transformers import pipeline

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

def extract_conditions(message):
    def classify(attribute, choices):
        result = classifier(
            message,
            choices,
            hypothesis_template=f"The room's {attribute} is {{}}."
        )
        return result["labels"][0]

    return {
        "temperature": classify("temperature", ["low", "medium", "high"]),
        "humidity": classify("humidity", ["low", "medium", "high"]),
        "sunlight": classify("sunlight", ["low", "medium", "high"])
    }
