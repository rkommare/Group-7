from transformers import pipeline

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

def extract_conditions(message,attributes):
    def classify(attribute, choices):
        result = classifier(
            message,
            choices,
            hypothesis_template=f"The room's {attribute} is {{}}."
        )
        return result["labels"][0]

    output = {}
    for a in attributes:
        output[a] = classify(a,["low", "medium", "high"])
    return output