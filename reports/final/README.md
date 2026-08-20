DATA 641 - Group 7  
Zachary Hamilton, Rithvik Kommareddy, Joseph Kutza  

# Introduction  
Welcome to the project page for Group 7 - FernWare!  
We have designed a chatbot that inputs a user's description about their living space and outputs a recommendation suite of plant species ideal for their home. Plants are a common household item that can be decorative or functional. Although they mostly require just two factors to survive, sunlight and water, the breadth and variety of plant species available makes it deceptively difficult to maintain them. Currently, there are many resources both online and in traditional media sources on the subject of plant care, however, there is a distinct lack of such information for helping people decide what to purchase initially or to get a quick summary of care guides. Our app aims to assist beginner and intermediate plant growers in purchasing and caring for plants tailored to their particular living space.

# How to Use Our Product  
Download the files from the "nlpapp", "data", and "app" folders and place in a directory on local machine. Using a program such as Visual Studio, run the index.html file as a live server and the app will launch as an .html tab in a web browser.

Install required packages:

python -m pip install flask torch transformers safetensors

python -m pip install pandas datasets accelerate

Start Application:
python server.py

It should be available at http://127.0.0.1:5000 after loading the model and the app
