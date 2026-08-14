from transformers import pipeline

path = "./parser_finetuned"
classifier = pipeline(
    "zero-shot-classification",
    model= path,
    tokenizer=path
)

def extract_conditions_ft(message,attributes):
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