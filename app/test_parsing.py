from parse_message import extract_conditions
from transformers import AutoModelForCausalLM, AutoTokenizer
import random

model_name = "Qwen/Qwen3-0.6B"

# load the tokenizer and the model
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
)

def test_baseline(n):
    def random_level():
        return ['low','medium','high'][random.randint(0,2)]

    attributes = ['temperature','humidity','sunlight']
    num_correct = [0] * len(attributes)
    for i in range(n):
        print(f"{i}/{n}")
        # prepare the model input
        ground_truth = {}
        for a in attributes:
            ground_truth[a] = random_level()
        strings = [f"{ground_truth[a]} {a}" for a in attributes]
        string = ', '.join(strings[:-1]) + ', and ' + strings[-1]
        prompt = f"Describe a room with {string} without using those words."
        messages = [
            {"role": "user", "content": prompt}
        ]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False # Switches between thinking and non-thinking modes. Default is True.
        )
        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

        # conduct text completion
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=32768
        )
        output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist() 

        content = tokenizer.decode(output_ids, skip_special_tokens=True).strip("\n")
        
        predictions = extract_conditions(content,attributes)

        for a in range(len(attributes)):
            if predictions[attributes[a]] == ground_truth[attributes[a]]:
                num_correct[a] += 1
    for a in range(len(attributes)):
        print(f'{attributes[a]} accuracy: {num_correct[a]/n}')
    print(f'total accuracy: {sum(num_correct)/(n*len(attributes))}')

test_baseline(1000)
