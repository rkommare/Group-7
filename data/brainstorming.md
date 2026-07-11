Wireframe
- Scraping the Notion site for data can be a headache because of dynamic JavaScript. We might want to start by creating a manual JSON database, which at least can be used for testing, until a better method for scraping the data can be found
- Code: You can make an HTML app that works directly in a web browser, using CSS to make it look clean and JavaScript to handle the logic

PROTOTYPE FOR MID SEMESTER PRES
Chatbot Logic: Likely use a decision tree. So we likely want the chatbot output to have clickable buttons for the user to press, to make it as easy as possible (minimum typing)
- Question 1: Start by selecting the window you want a plant to reside. What cardinal direction does the window face? Use the compass app on phones to help guide you, and round to the closest direction if needed.
	- North: Low light
	- East or West: Medium light (Bright, indirect light)
	- South: High light (Bright direct light)
- Question 2: How often do you want to water this plant?
	- Once a day
	- A few times a week
	- Rarely
- Question 3: How would you describe the humidity of the room?
	- Low (Heater or dry air)
	- Normal
	- High (Bathroom)
Output format
- A list of up to 3 plants that fits the criteria. Each outputted plant can have its own standardized card, containing some things like
	- A header of the plant's common name + its scientific name
	- A two sentence summary of its care routine and other fun facts
	- Visual tags like [Low Light] or [Low Water]
For the midsemester presentation prototype
- Focus on the genus for now. Then for the final presentation, add individual species within each genus

ADVANCED STUFF FOR FINAL ITERATION OF PROJECT
- Fertilization
- Propagation
- Soil preference
- Pruning and maintenance
