// Load the plant database. The Flask server exposes the project data directory.
let plantDatabase = [];

const plantDatabasePromise = fetch('../data/json/genus_desc.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(
                `Could not load genus_desc.json (HTTP ${response.status}).`
            );
        }

        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data)) {
            throw new Error('genus_desc.json must contain an array.');
        }

        plantDatabase = data;
    });


let userPreferences = {
    water: null,
    waterConfidence: null,
    waterMargin: null,
    sun: null,
    sunConfidence: null,
    sunMargin: null,
    humidity: null,
    humidityConfidence: null,
    humidityMargin: null
};



async function extractConditions(message) {
    const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Parser API failed (HTTP ${response.status}).`);
    }

    return data;
}


function percent(score) {
    return Math.round(Number(score) * 100);
}


function findUncertainConditions(preferences) {
    const conditions = [
        {
            name: 'sunlight',
            confidence: preferences.sunConfidence,
            margin: preferences.sunMargin
        },
        {
            name: 'watering',
            confidence: preferences.waterConfidence,
            margin: preferences.waterMargin
        },
        {
            name: 'humidity',
            confidence: preferences.humidityConfidence,
            margin: preferences.humidityMargin
        }
    ];

    return conditions
        .filter(condition => {
            return condition.confidence < 0.55 || condition.margin < 0.15;
        })
        .map(condition => condition.name);
}


async function handleUserInput(input) {
    appendBotMessage(
        'Finding the best plant for your conditions...'
    );

    await plantDatabasePromise;
    userPreferences = await extractConditions(input);

    appendBotMessage(
        `I detected:<br>` +
        `☀️ <strong>${escapeHtml(userPreferences.sun)}</strong> sunlight ` +
        `(${percent(userPreferences.sunConfidence)}% model score)<br>` +
        `💧 <strong>${escapeHtml(userPreferences.water)}</strong> watering ` +
        `(${percent(userPreferences.waterConfidence)}% model score)<br>` +
        `🌫️ <strong>${escapeHtml(userPreferences.humidity)}</strong> humidity ` +
        `(${percent(userPreferences.humidityConfidence)}% model score)`
    );

    const uncertain = findUncertainConditions(userPreferences);
    if (uncertain.length > 0) {
        appendBotMessage(
            `I'm less certain about <strong>${escapeHtml(
                uncertain.join(', ')
            )}</strong>. Try describing those conditions more specifically.`
        );
    }

    findMatches();
}


function findMatches() {
    let matches = plantDatabase.filter(plant => {
        return plant.lightRequired === userPreferences.sun &&
               plant.wateringSchedule === userPreferences.water &&
               plant.humidity === userPreferences.humidity;
    });

    let introduction =
        'Based on your conditions, select a genus to learn more:';

    if (matches.length === 0) {
        const rankedPlants = plantDatabase
            .map(plant => {
                const score =
                    Number(plant.lightRequired === userPreferences.sun) +
                    Number(plant.wateringSchedule === userPreferences.water) +
                    Number(plant.humidity === userPreferences.humidity);

                return { plant, score };
            })
            .sort((a, b) => b.score - a.score);

        const bestScore = rankedPlants[0]?.score ?? 0;

        matches = rankedPlants
            .filter(result => result.score === bestScore)
            .slice(0, 6)
            .map(result => result.plant);

        introduction =
            `I couldn't find an exact match, but these options match ` +
            `<strong>${bestScore} of 3</strong> conditions:`;
    }

    if (matches.length > 0) {
        const buttons = matches
            .map(plant => {
                const displayName = plant.genus.replaceAll('_', ' ');

                return `
                    <button
                        type="button"
                        class="plant-result-btn"
                        data-plant-id="${escapeHtml(plant.id)}"
                    >
                        ${escapeHtml(displayName)}
                    </button>
                `;
            })
            .join('');

        appendBotMessage(
            `${introduction}<div class="plant-results">${buttons}</div>`
        );
    } else {
        appendBotMessage("I couldn't find any plants in the plant database.");
    }
}


const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const popup = document.getElementById('plant-popup');
const popupClose = document.getElementById('plant-popup-close');

if (!chatLog || !userInput || !sendBtn) {
    throw new Error('Missing chat-log, user-input, or send-btn in index.html.');
}


function appendBotMessage(text) {
    const message = document.createElement('div');
    message.className = 'message bot-message';
    message.innerHTML = text;
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
}


function appendUserMessage(text) {
    const message = document.createElement('div');
    message.className = 'message user-message';
    message.innerText = text;
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
}


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
            `Could not analyze your description: ${escapeHtml(error.message)}`
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
    document.getElementById('plant-popup-title').textContent =
        plant.genus.replaceAll('_', ' ');
    document.getElementById('plant-popup-description').textContent =
        plant.description || 'No description is available for this plant.';
    document.getElementById('plant-popup-light').textContent =
        plant.lightRequired || 'Unknown';
    document.getElementById('plant-popup-water').textContent =
        plant.wateringSchedule || 'Unknown';
    document.getElementById('plant-popup-humidity').textContent =
        plant.humidity || 'Unknown';
    popup.classList.add('show');
}


function closePlantPopup() {
    popup?.classList.remove('show');
}


chatLog.addEventListener('click', event => {
    const button = event.target.closest('.plant-result-btn');

    if (!button) {
        return;
    }

    const selectedPlant = plantDatabase.find(plant => {
        return String(plant.id) === button.dataset.plantId;
    });

    if (selectedPlant && popup) {
        showPlantPopup(selectedPlant);
    }
});


if (popup && popupClose) {
    popupClose.addEventListener('click', closePlantPopup);
    popup.addEventListener('click', event => {
        if (event.target === popup) {
            closePlantPopup();
        }
    });
}


document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closePlantPopup();
    }
});

sendBtn.addEventListener('click', processSubmission);
userInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        processSubmission();
    }
});
