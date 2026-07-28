from transformers import AutoModelForCausalLM, AutoTokenizer
import random
import pandas

generator_name = "Qwen/Qwen3-0.6B"
generator_tokenizer = AutoTokenizer.from_pretrained(generator_name)
generator = AutoModelForCausalLM.from_pretrained(
    generator_name,
    torch_dtype="auto",
)

def generate_dataset(attributes,n):
    def random_level():
        return ['low','medium','high'][random.randint(0,2)]

    X = []
    labels = {}
    for a in attributes:
        labels[a] = []
    for i in range(n):
        print(f"{i}/{n}")
        ground_truth = {}
        for a in attributes:
            ground_truth[a] = random_level()
        strings = [f"{ground_truth[a]} {a}" for a in attributes]
        string = ', '.join(strings[:-1]) + ', and ' + strings[-1]
        prompt = f"Describe a room with {string} without using those words."
        messages = [
            {"role": "user", "content": prompt}
        ]
        text = generator_tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False # Switches between thinking and non-thinking modes. Default is True.
        )
        model_inputs = generator_tokenizer([text], return_tensors="pt").to(generator.device)
        
        # conduct text completion
        generated_ids = generator.generate(
            **model_inputs,
            max_new_tokens=32768
        )
        output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist() 
        
        content = generator_tokenizer.decode(output_ids, skip_special_tokens=True).strip("\n")
        X += [content]
        for a in attributes:
            labels[a] += [ground_truth[a]]
    return X,labels

attributes = ['temperature','humidity','sunlight']
X,labels = generate_dataset(attributes,1000)
labels['text'] = X
data = pandas.DataFrame(labels)
data.to_csv('./dataset/data.csv',index=False)