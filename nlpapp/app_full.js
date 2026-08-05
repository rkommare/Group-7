// Step 1: Load your JSON index

let classifier;
let plantDatabase = [];

fetch('../data/json/genus.json')
  .then(response => response.json())
  .then(data => { plantDatabase = data; });

// Step 2: Track user preferences
let userPreferences = {
    water: null,
    sun: null,
    humidity: null
};


// Step 3: Use NLP to extract conditions from one user message
async function extractConditions(message) {
    if (!classifier) {
        const { pipeline } = await import(
            'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1'
        );

        classifier = await pipeline(
            'zero-shot-classification',
            'Xenova/mobilebert-uncased-mnli'
        );
    }

    // Determine the user's watering availability
    const waterResult = await classifier(
        message,
        [
            'rare watering',
            'weekly watering',
            'frequent watering'
        ],
        {
            hypothesis_template:
                "The user's plant watering schedule is {}."
        }
    );

    // Determine the room humidity
    const humidityResult = await classifier(
        message,
        [
            'low humidity',
            'medium humidity',
            'high humidity'
        ],
        {
            hypothesis_template:
                'The room has {}.'
        }
    );

    // Determine the room sunlight
    const sunlightResult = await classifier(
        message,
        [
            'low sunlight',
            'medium sunlight',
            'high sunlight'
        ],
        {
            hypothesis_template:
                'The room has {}.'
        }
    );

    // Convert the model's labels to the values used by genus.json
    const waterMap = {
        'rare watering': 'low',
        'weekly watering': 'medium',
        'frequent watering': 'high'
    };

    const humidityMap = {
        'low humidity': 'low',
        'medium humidity': 'medium',
        'high humidity': 'high'
    };

    const sunlightMap = {
        'low sunlight': 'low',
        'medium sunlight': 'medium',
        'high sunlight': 'high'
    };

    return {
        water: waterMap[waterResult.labels[0]],
        humidity: humidityMap[humidityResult.labels[0]],
        sun: sunlightMap[sunlightResult.labels[0]]
    };
}


// Handle the user's complete natural-language description
async function handleUserInput(input) {
    appendBotMessage(
        "Analyzing your description. The model may take a moment to load..."
    );

    userPreferences = await extractConditions(input);

    appendBotMessage(
        `I detected <strong>${userPreferences.sun}</strong> sunlight, ` +
        `<strong>${userPreferences.water}</strong> watering, and ` +
        `<strong>${userPreferences.humidity}</strong> humidity.`
    );

    findMatches();
}


// Step 4: Filter the JSON data based on collected preferences
function findMatches() {
    const matches = plantDatabase.filter(plant => {
        return plant.lightRequired === userPreferences.sun &&
               plant.wateringSchedule === userPreferences.water &&
               plant.humidity === userPreferences.humidity;
    });

    if (matches.length > 0) {
        const buttons = matches
            .map(plant => {
                const displayName = plant.genus.replaceAll('_', ' ');

                return `
                    <button
                        type="button"
                        class="plant-result-btn"
                        data-plant-id="${plant.id}"
                    >
                        ${escapeHtml(displayName)}
                    </button>
                `;
            })
            .join('');

        appendBotMessage(
            `Based on your conditions, select a genus to learn more:` +
            `<div class="plant-results">${buttons}</div>`
        );
    } else {
        appendBotMessage(
            "Hmm, I couldn't find a perfect match for that exact " +
            "description. Try describing different conditions."
        );
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Grab DOM elements
const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');


// Verify that the necessary HTML elements exist
if (!chatLog || !userInput || !sendBtn) {
    throw new Error(
        "Missing chat-log, user-input, or send-btn in index.html."
    );
}


// Append text to chat UI helper function
function appendBotMessage(text) {
    const msg = document.createElement('div');

    msg.className = 'message bot-message';
    msg.innerHTML = text;

    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
}


function appendUserMessage(text) {
    const msg = document.createElement('div');

    msg.className = 'message user-message';
    msg.innerText = text;

    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
}


// Trigger action function
async function processSubmission() {
    const text = userInput.value.trim();

    if (!text) {
        return;
    }

    appendUserMessage(text);
    userInput.value = '';

    sendBtn.disabled = true;
    userInput.disabled = true;

    try {
        await handleUserInput(text);
    } catch (error) {
        console.error(error);

        appendBotMessage(
            "Could not analyze your description. Check the browser console."
        );
    } finally {
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function showPlantPopup(plant) {
    const displayName = plant.genus.replaceAll('_', ' ');

    document.getElementById('plant-popup-title').textContent = displayName;

    document.getElementById('plant-popup-description').textContent =
        plant.description || 'No description is available for this plant.';

    document.getElementById('plant-popup-light').textContent =
        plant.lightRequired || 'Unknown';

    document.getElementById('plant-popup-water').textContent =
        plant.wateringSchedule || 'Unknown';

    document.getElementById('plant-popup-humidity').textContent =
        plant.humidity || 'Unknown';

    document.getElementById('plant-popup').classList.add('show');
}


function closePlantPopup() {
    document.getElementById('plant-popup').classList.remove('show');
}


// Use event delegation because result buttons are created dynamically.
chatLog.addEventListener('click', event => {
    const button = event.target.closest('.plant-result-btn');

    if (!button) {
        return;
    }

    const plantId = Number(button.dataset.plantId);

    const selectedPlant = plantDatabase.find(plant => {
        return plant.id === plantId;
    });

    if (selectedPlant) {
        showPlantPopup(selectedPlant);
    }
});


document
    .getElementById('plant-popup-close')
    .addEventListener('click', closePlantPopup);


document
    .getElementById('plant-popup')
    .addEventListener('click', event => {
        if (event.target.id === 'plant-popup') {
            closePlantPopup();
        }
    });


document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closePlantPopup();
    }
});
// Add listeners for both button click and Enter keystroke
sendBtn.addEventListener('click', processSubmission);

userInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        processSubmission();
    }
});