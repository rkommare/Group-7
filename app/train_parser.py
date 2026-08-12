import pandas as pd
from datasets import Dataset
from transformers import AutoTokenizer
from transformers import AutoModelForSequenceClassification
from transformers import DataCollatorWithPadding 
from transformers import TrainingArguments
from transformers import Trainer

attributes = ['temperature','humidity','sunlight']
values = ['low','medium','high']
raw = pd.read_csv("./dataset/data.csv")
premises = []
hypotheses = []
labels = []

texts = raw['text']
features = {}
for a in attributes:
    features[a] = raw[a]

for i in range(len(texts)):
    for a in attributes:
        for v in values:
            premises += [texts[i]]
            hypotheses += [f"The room's {a} is {v}."]
            labels += [2] if features[a][i] == v else [0]

dataset = Dataset.from_dict({'premise':premises,'hypothesis':hypotheses,'label':labels})

model_name = "facebook/bart-large-mnli"
tokenizer = AutoTokenizer.from_pretrained(model_name)

def tokenize_function(batch): 
    return tokenizer(batch["premise"], 
                     batch["hypothesis"], 
                     truncation=True)

dataset = dataset.map(tokenize_function, batched=True, remove_columns=["premise", "hypothesis"])
dataset = dataset.train_test_split(test_size=0.2)

id2label = {0: "contradiction", 1: "neutral", 2: "entailment"}
label2id = {"contradiction": 0, "neutral": 1, "entailment": 2}
model = AutoModelForSequenceClassification.from_pretrained(model_name, 
                                                           num_labels=3, 
                                                           id2label=id2label, 
                                                           label2id=label2id,
                                                           dtype="auto")

data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

training_args = TrainingArguments(
    output_dir="parser_finetuned",
    num_train_epochs=1,
    per_device_train_batch_size=4,
    bf16=True,
    learning_rate=2e-5,
    logging_strategy='no',
    save_strategy="no"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    processing_class=tokenizer,
    data_collator=data_collator
)
trainer.train()

trainer.save_model("parser_finetuned")
tokenizer.save_pretrained("parser_finetuned")