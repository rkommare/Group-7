from transformers import AutoModelForCausalLM, AutoTokenizer
import pandas as pd
import random
import torch

random.seed(42)
torch.manual_seed(42)

generator_name = "Qwen/Qwen3-0.6B"
device = "cuda" if torch.cuda.is_available() else "cpu"

generator_tokenizer = AutoTokenizer.from_pretrained(generator_name)
generator = AutoModelForCausalLM.from_pretrained(
    generator_name,
    torch_dtype="auto",
).to(device)

generator.eval()


def generate_dataset(attributes, n):
    def random_level():
        return random.choice(["low", "medium", "high"])

    examples = []
    labels = {attribute: [] for attribute in attributes}

    for i in range(n):
        print(f"{i + 1}/{n}")

        ground_truth = {
            attribute: random_level()
            for attribute in attributes
        }

        prompt = f"""
Write one concise, natural description of someone's houseplant environment.

The intended conditions are:
- Watering frequency: {ground_truth["watering"]}
- Room humidity: {ground_truth["humidity"]}
- Sunlight: {ground_truth["sunlight"]}

Express these conditions naturally without using the words
"low", "medium", or "high". Return only the description.
""".strip()

        messages = [{"role": "user", "content": prompt}]

        text = generator_tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False
        )

        model_inputs = generator_tokenizer(
            [text],
            return_tensors="pt"
        ).to(device)

        with torch.no_grad():
            generated_ids = generator.generate(
                **model_inputs,
                max_new_tokens=100,
                do_sample=True,
                temperature=0.85,
                top_p=0.95,
                repetition_penalty=1.05,
                pad_token_id=generator_tokenizer.eos_token_id
            )

        output_ids = generated_ids[0][
            len(model_inputs.input_ids[0]):
        ]

        content = generator_tokenizer.decode(
            output_ids,
            skip_special_tokens=True
        ).strip()

        examples.append(content)

        for attribute in attributes:
            labels[attribute].append(ground_truth[attribute])

    return examples, labels


attributes = ["watering", "humidity", "sunlight"]
examples, labels = generate_dataset(attributes, 1000)

data = pd.DataFrame({
    "text": examples,
    **labels
})

print(f"Duplicate descriptions: {data['text'].duplicated().sum()}")

data.to_csv("./dataset/data.csv", index=False)
print("Saved dataset/data.csv")