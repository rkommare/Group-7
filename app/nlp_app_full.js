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


function createEmptyPreferences() {
    return {
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
}


let userPreferences = createEmptyPreferences();

// Stores the condition associated with the most recent follow-up question.
// Possible values are "sun", "water", "humidity", or null.
let pendingCondition = null;


const CONDITIONS = [
    {
        value: 'sun',
        confidence: 'sunConfidence',
        margin: 'sunMargin',
        name: 'sunlight',
        icon: '☀️',
        pattern:
            /\b(sun|sunlight|light|bright|dim|dark|shade|shady|window|direct|indirect|sunny)\b/i,
        question: 'How much natural light does the space receive?'
    },
    {
        value: 'water',
        confidence: 'waterConfidence',
        margin: 'waterMargin',
        name: 'watering',
        icon: '💧',
        pattern:
            /\b(water|watering|weekly|daily|often|frequent|frequently|rarely|occasionally|soil|moist)\b/i,
        question: 'How often would you like to water the plant?'
    },
    {
        value: 'humidity',
        confidence: 'humidityConfidence',
        margin: 'humidityMargin',
        name: 'humidity',
        icon: '🌫️',
        pattern:
            /\b(humid|humidity|humidifier|dry|damp|steamy|bathroom|moist air)\b/i,
        question: 'Is the room’s air dry, average, or humid?'
    }
];


// Send a message to the Flask model API.
async function extractConditions(message) {
    const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `The parser API returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            `Parser API failed (HTTP ${response.status}).`
        );
    }

    return data;
}


function percent(score) {
    return Math.round(Number(score) * 100);
}


// Interpret short answers such as "lots" based on the question
// that the chatbot most recently asked.
function normalizeFollowUpAnswer(input, conditionName) {
    const text = input.toLowerCase().trim();

    // General answers that work for all three conditions.
    if (
        /\b(low|little|very little|not much|not a lot|hardly any|none)\b/
            .test(text)
    ) {
        return 'low';
    }

    if (
        /\b(medium|some|moderate|average|normal)\b/
            .test(text)
    ) {
        return 'medium';
    }

    if (
        /\b(high|lots?|a lot|plenty|very much)\b/
            .test(text)
    ) {
        return 'high';
    }

    // Interpret vocabulary based on the pending question.
    if (conditionName === 'sun') {
        if (
            /\b(dark|dim|shady|shade|no windows?|very little light)\b/
                .test(text)
        ) {
            return 'low';
        }

        if (
            /\b(indirect|partly bright|some light)\b/
                .test(text)
        ) {
            return 'medium';
        }

        if (
            /\b(bright|sunny|direct|large window|lots of light)\b/
                .test(text)
        ) {
            return 'high';
        }
    }

    if (conditionName === 'water') {
        if (
            /\b(rarely|infrequently|almost never|once a month)\b/
                .test(text)
        ) {
            return 'low';
        }

        if (
            /\b(weekly|once a week|sometimes|occasionally)\b/
                .test(text)
        ) {
            return 'medium';
        }

        if (
            /\b(often|frequent|frequently|daily|every day)\b/
                .test(text)
        ) {
            return 'high';
        }
    }

    if (conditionName === 'humidity') {
        if (
            /\b(dry|dry air|very dry)\b/
                .test(text)
        ) {
            return 'low';
        }

        if (
            /\b(average|normal|comfortable)\b/
                .test(text)
        ) {
            return 'medium';
        }

        if (
            /\b(humid|damp|steamy|very humid|bathroom)\b/
                .test(text)
        ) {
            return 'high';
        }
    }

    return null;
}


// Display all conditions that have been collected so far.
function displayKnownConditions() {
    const known = CONDITIONS.filter(condition => {
        return userPreferences[condition.value] !== null;
    });

    if (known.length === 0) {
        return;
    }

    const detectedLines = known.map(condition => {
        const confidence =
            userPreferences[condition.confidence];

        const scoreText =
            confidence === null
                ? '(provided directly)'
                : `(${percent(confidence)}% model score)`;

        return (
            `${condition.icon} ` +
            `<strong>${escapeHtml(
                userPreferences[condition.value]
            )}</strong> ${condition.name} ${scoreText}`
        );
    });

    appendBotMessage(
        `So far I detected:<br>${detectedLines.join('<br>')}`
    );
}


// Handle a complete user submission.
async function handleUserInput(input) {
    appendBotMessage(
        'Finding the best plant for your conditions...'
    );

    await plantDatabasePromise;

    const conditionBeingAnswered = pendingCondition;

    const followUpLevel =
        conditionBeingAnswered === null
            ? null
            : normalizeFollowUpAnswer(
                input,
                conditionBeingAnswered
            );

    // The API is still called because the message may contain information
    // about more than one condition.
    const parsed = await extractConditions(input);

    for (const condition of CONDITIONS) {
        const directFollowUp =
            conditionBeingAnswered === condition.value &&
            followUpLevel !== null;

        if (directFollowUp) {
            userPreferences[condition.value] =
                followUpLevel;

            // A direct answer came from our normalization rules rather than
            // the model, so it does not have a model score.
            userPreferences[condition.confidence] = null;
            userPreferences[condition.margin] = null;

            continue;
        }

        const mentioned = condition.pattern.test(input);

        const confidence =
            Number(parsed[condition.confidence]);

        const margin =
            Number(parsed[condition.margin]);

        const reliable =
            Number.isFinite(confidence) &&
            Number.isFinite(margin) &&
            confidence >= 0.65 &&
            margin >= 0.30;

        // Only accept the model's classification when the message
        // mentioned the condition and the model was sufficiently reliable.
        if (mentioned && reliable) {
            userPreferences[condition.value] =
                parsed[condition.value];

            userPreferences[condition.confidence] =
                confidence;

            userPreferences[condition.margin] =
                margin;
        }
    }

    // The previous follow-up has now been processed.
    pendingCondition = null;

    displayKnownConditions();

    const missing = CONDITIONS.filter(condition => {
        return userPreferences[condition.value] === null;
    });

    if (missing.length > 0) {
        // Remember which question is being asked so a short answer such as
        // "lots" can be interpreted during the next submission.
        pendingCondition = missing[0].value;

        appendBotMessage(
            `I still need information about ` +
            `<strong>${missing
                .map(condition => condition.name)
                .join(', ')}</strong>.<br>` +
            missing[0].question
        );

        return;
    }

    // Only recommend plants after all three conditions are known.
    findMatches();
}


// Compare the collected conditions with the plant database.
function findMatches() {
    let matches = plantDatabase.filter(plant => {
        return (
            plant.lightRequired === userPreferences.sun &&
            plant.wateringSchedule === userPreferences.water &&
            plant.humidity === userPreferences.humidity
        );
    });

    let introduction =
        'Based on your conditions, select a genus to learn more:';

    // If there is no exact match, rank plants by the number
    // of matching conditions.
    if (matches.length === 0) {
        const rankedPlants = plantDatabase
            .map(plant => {
                const score =
                    Number(
                        plant.lightRequired === userPreferences.sun
                    ) +
                    Number(
                        plant.wateringSchedule === userPreferences.water
                    ) +
                    Number(
                        plant.humidity === userPreferences.humidity
                    );

                return {
                    plant,
                    score
                };
            })
            .sort((first, second) => {
                return second.score - first.score;
            });

        const bestScore = rankedPlants[0]?.score ?? 0;

        matches = rankedPlants
            .filter(result => {
                return result.score === bestScore;
            })
            .slice(0, 6)
            .map(result => {
                return result.plant;
            });

        introduction =
            `I couldn't find an exact match, but these options match ` +
            `<strong>${bestScore} of 3</strong> conditions:`;
    }

    if (matches.length > 0) {
        const buttons = matches
            .map(plant => {
                const displayName =
                    String(plant.genus)
                        .replaceAll('_', ' ');

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
            `${introduction}` +
            `<div class="plant-results">${buttons}</div>`
        );
    } else {
        appendBotMessage(
            "I couldn't find any plants in the plant database."
        );
    }

    // Reset the conversation after showing recommendations.
    userPreferences = createEmptyPreferences();
    pendingCondition = null;
}


// Grab the required HTML elements.
const chatLog =
    document.getElementById('chat-log');

const userInput =
    document.getElementById('user-input');

const sendBtn =
    document.getElementById('send-btn');

const popup =
    document.getElementById('plant-popup');

const popupClose =
    document.getElementById('plant-popup-close');


if (!chatLog || !userInput || !sendBtn) {
    throw new Error(
        'Missing chat-log, user-input, or send-btn in index.html.'
    );
}


// Append a bot message to the chat window.
function appendBotMessage(text) {
    const message =
        document.createElement('div');

    message.className =
        'message bot-message';

    message.innerHTML = text;

    chatLog.appendChild(message);
    chatLog.scrollTop =
        chatLog.scrollHeight;
}


// Append a user message to the chat window.
function appendUserMessage(text) {
    const message =
        document.createElement('div');

    message.className =
        'message user-message';

    message.innerText = text;

    chatLog.appendChild(message);
    chatLog.scrollTop =
        chatLog.scrollHeight;
}


// Process the Send button or Enter key.
async function processSubmission() {
    const text =
        userInput.value.trim();

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
            `Could not analyze your description: ` +
            `${escapeHtml(error.message)}`
        );
    } finally {
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}


// Escape database values before inserting them into HTML.
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


// Open the plant information popup.
function showPlantPopup(plant) {
    if (!popup) {
        return;
    }

    const title =
        document.getElementById('plant-popup-title');

    const description =
        document.getElementById('plant-popup-description');

    const light =
        document.getElementById('plant-popup-light');

    const water =
        document.getElementById('plant-popup-water');

    const humidity =
        document.getElementById('plant-popup-humidity');

    if (title) {
        title.textContent =
            String(plant.genus)
                .replaceAll('_', ' ');
    }

    if (description) {
        description.textContent =
            plant.description ||
            'No description is available for this plant.';
    }

    if (light) {
        light.textContent =
            plant.lightRequired || 'Unknown';
    }

    if (water) {
        water.textContent =
            plant.wateringSchedule || 'Unknown';
    }

    if (humidity) {
        humidity.textContent =
            plant.humidity || 'Unknown';
    }

    popup.classList.add('show');
}


// Close the plant information popup.
function closePlantPopup() {
    popup?.classList.remove('show');
}


// Result buttons are created dynamically, so use event delegation.
chatLog.addEventListener('click', event => {
    const button =
        event.target.closest('.plant-result-btn');

    if (!button) {
        return;
    }

    const selectedPlant =
        plantDatabase.find(plant => {
            return (
                String(plant.id) ===
                button.dataset.plantId
            );
        });

    if (selectedPlant) {
        showPlantPopup(selectedPlant);
    }
});


if (popup && popupClose) {
    popupClose.addEventListener(
        'click',
        closePlantPopup
    );

    popup.addEventListener('click', event => {
        if (event.target === popup) {
            closePlantPopup();
        }
    });
}


// Allow Escape to close the popup.
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closePlantPopup();
    }
});


// Submit using the Send button.
sendBtn.addEventListener(
    'click',
    processSubmission
);


// Submit using the Enter key.
userInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.repeat) {
        processSubmission();
    }
});