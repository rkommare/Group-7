// Step 1: Load your JSON index
let plantDatabase = [];
fetch('genus.json')
  .then(response => response.json())
  .then(data => { plantDatabase = data; });

// Step 2: Track user preferences and conversation state
let userPreferences = { water: null, sun: null, humidity: null };
let currentStep = 'welcome'; 

// Step 3: Handle the conversation flow
function handleUserInput(input) {
    const cleanInput = input.toLowerCase().trim();

    if (currentStep === 'welcome') {
        appendBotMessage("Welcome to fern-ware! Let's find your perfect indoor plant. First, how much natural light does the spot get? (Low, Medium, High)");
        currentStep = 'ask_sun';
        return;
    }

    if (currentStep === 'ask_sun') {
        if (!['low', 'medium', 'high'].includes(cleanInput)) {
            appendBotMessage("Please answer with Low, Medium, or High.");
            return;
        }
        userPreferences.sun = cleanInput;
        appendBotMessage("Got it. How often are you able to water it? (Low = rarely, Medium = weekly, High = frequent)");
        currentStep = 'ask_water';
        return;
    }

    if (currentStep === 'ask_water') {
        if (!['low', 'medium', 'high'].includes(cleanInput)) {
            appendBotMessage("Please answer with Low, Medium, or High.");
            return;
        }
        userPreferences.water = cleanInput;
        appendBotMessage("Last question: What is the humidity like in that room? (Low, Medium, High)");
        currentStep = 'ask_humidity';
        return;
    }

    if (currentStep === 'ask_humidity') {
        if (!['low', 'medium', 'high'].includes(cleanInput)) {
            appendBotMessage("Please answer with Low, Medium, or High.");
            return;
        }
        userPreferences.humidity = cleanInput;
        
        // Final Step: Filter and recommend
        findMatches();
    }
}

// Step 4: Filter the JSON data based on collected preferences
function findMatches() {
    const matches = plantDatabase.filter(plant => {
        return plant.lightRequired === userPreferences.sun &&
               plant.wateringSchedule === userPreferences.water &&
               plant.humidity === userPreferences.humidity;
    });

    if (matches.length > 0) {
        const names = matches.map(p => p.genus).join(', ');
        appendBotMessage(`Based on your conditions, you should look into these genera: <strong>${names}<strong>!`);
    } else {
        appendBotMessage("Hmm, I couldn't find a perfect match for that exact combination. Let's try adjusting your parameters! Type anything to restart.");
    }
    
    // Reset for a new search
    currentStep = 'welcome';
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Grab DOM elements
const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Append text to chat UI helper function
function appendBotMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message bot-message';
    msg.innerHTML = text; // innerHTML allows bolding tags if needed
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight; // Auto-scrolls to the bottom
}

function appendUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message user-message';
    msg.innerText = text;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// Trigger action function
function processSubmission() {
    const text = userInput.value.trim();
    if (!text) return; // ignore empty inputs
    
    appendUserMessage(text);
    userInput.value = ''; // clear text field
    
    // Pass it off to the State Machine function we wrote earlier
    handleUserInput(text); 
}

// Add listeners for both button click and 'Enter' keystroke
sendBtn.addEventListener('click', processSubmission);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') processSubmission();
});