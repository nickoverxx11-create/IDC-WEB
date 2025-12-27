// Global variables
let testPokemon = [];
let trainingPokemonPool = [];
let zone1Rules = [null, null, null, null];
let zone2Rules = { fire: [null, null, null, null], water: [null, null, null, null], grass: [null, null, null, null], dragon: [null, null, null, null] };
let zone3Step = 0;
let zone3Selections = [];
let zone4Selections = [];
let currentZone = 1;
let availableDatasets = {};
let z2StatsDone = false;
let z2SingleCount = 0;

const features = [
    { id: 'Attack', name: 'Attack', high: '⚔️ High Attack', low: '⚪ Low Attack' },
    { id: 'Defense', name: 'Defense', high: '🛡️ High Defense', low: '🩹 Low Defense' },
    { id: 'Speed', name: 'Speed', high: '⚡ High Speed', low: '🐢 Low Speed' },
    { id: 'HasWings', name: 'Wings', high: '🦅 Has Wings', low: '🚫 No Wings' },
    { id: 'HabitatTemperature', name: 'Temp', high: '🌡️ High Temp', low: '❄️ Low Temp' },
    { id: 'HabitatAltitude', name: 'Altitude', high: '🏔️ High Altitude', low: '🌊 Low Altitude' }
];
const types = ['fire', 'water', 'grass', 'dragon'];


// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Load data from JSON files first
    const data = await loadGameData();
    if (data) {
        testPokemon = data.testPokemon;
        trainingPokemonPool = data.trainingPokemonPool;
        initializeZone4Data(); 
        // Initialize UI
        initializeLedBoard();
        generateFeatureCards();
        generateDatasetCards();
        switchZone(1);
    }
});

function generateFeatureCards() {
    const banks = ['feature-bank-list-z1', 'feature-bank-list-z2'];
    banks.forEach(bankId => {
        const bank = document.getElementById(bankId);
        bank.innerHTML = '';
        features.forEach(f => {
            const card = document.createElement('div');
            card.className = 'feature-card';
            card.draggable = true;
            card.dataset.feature = f.id;
            card.dataset.state = 'high';
            card.textContent = f.high;
            card.onclick = () => flipCard(card);
            card.ondragstart = dragStart;
            bank.appendChild(card);
        });
    });
}

function generateDatasetCards() {
    const container = document.getElementById('zone4-dataset-cards');
    container.innerHTML = '';

    // Loop through the availableDatasets object
    for (const key in availableDatasets) {
        const d = availableDatasets[key];
        const isPure = d.quality === 'pure';
        
        // Create HTML for card
        const cardHtml = `
            <div class="dataset-card ${isPure ? 'pure' : 'noisy'}" 
                 onclick="selectDataset('${d.id}')" 
                 data-dataset="${d.id}" 
                 style="grid-column: span ${d.span || 1};">
                <h4>${d.name}</h4>
                <div class="count">${d.count}</div>
                <p>${isPure ? 'High Quality Data' : 'Contains Errors'}</p>
            </div>
        `;
        container.innerHTML += cardHtml;
    }
}

function flipCard(cardElement) {
    const featureId = cardElement.dataset.feature;
    const feature = features.find(f => f.id === featureId);
    const currentState = cardElement.dataset.state;
    const newState = currentState === 'high' ? 'low' : 'high';
    cardElement.dataset.state = newState;
    cardElement.textContent = feature[newState];
    cardElement.classList.toggle('low-state');
}

function allowDrop(ev) { ev.preventDefault(); }

function dragStart(ev) {
    ev.dataTransfer.setData("text/plain", JSON.stringify({
        feature: ev.target.dataset.feature,
        state: ev.target.dataset.state,
        text: ev.target.textContent
    }));
    ev.target.classList.add('dragging');
}

function dropFeature(ev, zone, slotIndex, type = null) {
    ev.preventDefault();
    const rawData = ev.dataTransfer.getData("text/plain");
    if (!rawData) return;

    const data = JSON.parse(rawData);
    
    // --- 1. IDENTIFY THE TARGET RULE LIST ---
    // We need to know which list of rules we are currently checking against.
    let currentRuleList = null;
    if (zone === 1) {
        currentRuleList = zone1Rules;
    } else if (zone === 2 && type) {
        currentRuleList = zone2Rules[type];
    }

    if (!currentRuleList) return; // Safety check

    // --- 2. CHECK: SEQUENTIAL ORDER ---
    // We cannot drop into slotIndex (e.g., 2) if slotIndex-1 (e.g., 1) is empty.
    // We loop from 0 up to the current slot.
    for (let i = 0; i < slotIndex; i++) {
        if (currentRuleList[i] === null) {
            alert("⚠️ Please fill the slots in order! (Slot " + (i + 1) + " is empty)");
            return; // Stop the function
        }
    }

    // --- 3. CHECK: DUPLICATE FEATURES ---
    // Check if this feature ID (e.g., 'Attack') already exists in a DIFFERENT slot.
    const isDuplicate = currentRuleList.some((rule, index) => {
        // If rule exists AND features match AND it's not the slot we are currently dropping into
        return rule !== null && rule.feature === data.feature && index !== slotIndex;
    });

    if (isDuplicate) {
        alert("⚠️ You already used '" + data.text + "'! You cannot use the same feature twice.");
        return; // Stop the function
    }

    // --- 4. PROCEED WITH DROP (Existing Logic) ---
    const slotElement = ev.currentTarget;
    
    // Update Text
    const existingLabel = slotElement.querySelector('.slot-label')?.outerHTML || '';
    slotElement.innerHTML = `<strong>${data.text}</strong>${existingLabel}`;
    slotElement.classList.add('filled');
    
    // Apply Color Logic (Green vs Red)
    if (data.state === 'low') {
        slotElement.classList.add('low-state');
    } else {
        slotElement.classList.remove('low-state');
    }

    // Save Rule Logic
    const rule = { feature: data.feature, state: data.state };

    if (zone === 1) {
        zone1Rules[slotIndex] = rule;
    } else if (zone === 2 && type) {
        zone2Rules[type][slotIndex] = rule;
    }
    
    updateLedBoard();
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

function initializeZone4Data() {
    // Slice the data as requested
    const clear_fire_data = trainingPokemonPool.slice(0, 20);
    const noisy_fire_data = trainingPokemonPool.slice(20, 40);
    const clear_water_data = trainingPokemonPool.slice(40, 60);
    const noisy_water_data = trainingPokemonPool.slice(60, 80);
    const clear_grass_data = trainingPokemonPool.slice(80, 100);
    const noisy_grass_data = trainingPokemonPool.slice(100, 120);
    const clear_dragon_data = trainingPokemonPool.slice(120, 140);
    const noisy_dragon_data = trainingPokemonPool.slice(140, 160);

    const mixed_data = [
        ...clear_fire_data.slice(0, 5),
        ...clear_water_data.slice(0, 5),
        ...clear_grass_data.slice(0, 5),
        ...clear_dragon_data.slice(0, 5)
    ];

    availableDatasets = {
        '1': { id: '1', name: "🔥 Clear Fire", count: 20, data: clear_fire_data, type: 'fire', quality: 'pure' },
        '2': { id: '2', name: "💧 Clear Water", count: 20, data: clear_water_data, type: 'water', quality: 'pure' },
        '3': { id: '3', name: "🍃 Clear Grass", count: 20, data: clear_grass_data, type: 'grass', quality: 'pure' },
        '4': { id: '4', name: "🐉 Clear Dragon", count: 20, data: clear_dragon_data, type: 'dragon', quality: 'pure' },
        '5': { id: '5', name: "🔥 Rare Fire", count: 20, data: noisy_fire_data, type: 'fire', quality: 'noisy' },
        '6': { id: '6', name: "💧 Meowth Water", count: 20, data: noisy_water_data, type: 'water', quality: 'noisy' },
        '7': { id: '7', name: "🍃 Rare Grass", count: 20, data: noisy_grass_data, type: 'grass', quality: 'noisy' },
        '8': { id: '8', name: "🐉 Meowth Dragon", count: 20, data: noisy_dragon_data, type: 'dragon', quality: 'noisy' },
        '9': { id: '9', name: "🌈 Big Clear Mix", count: 20, span: 2, data: mixed_data, type: 'mixed', quality: 'pure' }
    };
}

const typeRows = ['fire', 'water', 'grass', 'dragon']; // 4 rows
const featureCols = ['Attack', 'Defense', 'Speed', 'HasWings', 'HabitatTemperature', 'HabitatAltitude']; // 6 columns

function initializeLedBoard() {
    const grid = document.getElementById('led-grid-content');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Create 4 rows of 6
    typeRows.forEach(tId => {
        featureCols.forEach(fId => {
            grid.innerHTML += `
                <div class="led-cell-compact" id="led-${tId}-${fId}">
                    <div class="led-compact"></div>
                    <div class="led-compact"></div>
                    <div class="led-compact"></div>
                </div>`;
        });
    });
}

function updateLedBoard() {
    clearLedBoard();
    if (currentZone === 1) {
        zone1Rules.forEach(rule => {
            if (rule) renderLeds(`led-fire-${rule.feature}`, rule.state === 'high' ? 3 : -3);
        });
    } else if (currentZone === 2) {
        types.forEach(type => {
            zone2Rules[type].forEach((rule, i) => {
                if (rule) {
                    let value = 0;
                    if (i === 0) value = 3;
                    else if (i === 1 || i === 2) value = 2;
                    else if (i === 3) value = 1;
                    renderLeds(`led-${type}-${rule.feature}`, rule.state === 'high' ? value : -value);
                }
            });
        });
    }
}

function showLearnedWeights(weights) {
    clearLedBoard();
    types.forEach(type => {
        features.forEach(feature => {
            if (weights[type] && weights[type][feature.id] !== undefined) {
                renderLeds(`led-${type}-${feature.id}`, weights[type][feature.id]);
            }
        });
    });
}

function renderLeds(cellId, value) {
    const cell = document.getElementById(cellId);
    if (!cell) return;
    const leds = cell.querySelectorAll('.led-compact');
    leds.forEach(led => { led.className = 'led-compact'; });
    
    if (value > 0) {
        for (let i = 0; i < value; i++) leds[i].classList.add('green');
    } else if (value < 0) {
        for (let i = 0; i < Math.abs(value); i++) leds[i].classList.add('red');
    }
}

function clearLedBoard() { 
    document.querySelectorAll('.led-compact').forEach(led => led.className = 'led-compact'); 
}

let z1StatsDone = false;
let z1SingleCount = 0;

function testZone1() {
    // 1. Validation
    const rules = zone1Rules.filter(r => r);
    if (rules.length === 0) { 
        alert("Please add at least one rule first!"); 
        return; 
    }

    // 2. Calculation logic
    let fireCorrect = 0, nonFireCorrect = 0;
    testPokemon.forEach(p => {
        let matchesAll = true;
        rules.forEach(rule => {
            let pokeValue = p[rule.feature];
            // Binary logic for wings, threshold logic for stats
            if (rule.feature !== 'HasWings') pokeValue = pokeValue > 5 ? 1 : 0;
            const ruleValue = rule.state === 'high' ? 1 : 0;
            if (pokeValue !== ruleValue) matchesAll = false;
        });
        
        const predictedIsFire = matchesAll;
        if (p.CorrectType === 'fire' && predictedIsFire) fireCorrect++;
        if (p.CorrectType !== 'fire' && !predictedIsFire) nonFireCorrect++;
    });

    const accuracy = ((fireCorrect + nonFireCorrect) / testPokemon.length) * 100;

    // 3. UI Update - Show result in the mini-block
    const display = document.getElementById('zone1-stats-results');
    if (display) {
        display.innerHTML = `
            <div style="background: white; padding: 10px; border-radius: 8px; margin-top:10px; border: 1px solid #2196f3;">
                <p>✅ Experiment Complete!</p>
                <p><strong>Accuracy: ${accuracy.toFixed(1)}%</strong></p>
                <p style="font-size: 0.8em; color: #666;">(${fireCorrect}/25 Fire found, ${nonFireCorrect}/75 non-Fire rejected)</p>
            </div>
        `;
    }
    
    // 4. UNLOCK Step 2
    z1StatsDone = true;
    const step2Section = document.getElementById('single-test-zone1');
    if (step2Section) {
        step2Section.classList.remove('locked'); // This makes the mystery box colorful and clickable
    }
}

function testZone2() {
    // 1. Validation (Check if fire has rules as a proxy)
    if (zone2Rules.fire.every(r => r === null)) {
        alert("Please set up your Master Plan rules for all types first!");
        return;
    }

    let totalCorrect = 0;
    testPokemon.forEach(p => {
        const scores = { fire: 0, water: 0, grass: 0, dragon: 0 };
        types.forEach(type => {
            zone2Rules[type].forEach((rule, i) => {
                if (rule) {
                    let pokeValue = p[rule.feature];
                    if (rule.feature !== 'HasWings') pokeValue = pokeValue > 5 ? 1 : 0;
                    const ruleValue = rule.state === 'high' ? 1 : 0;
                    if (pokeValue === ruleValue) {
                        const pts = (i === 0) ? 3 : (i < 3 ? 2 : 1);
                        scores[type] += pts;
                    }
                }
            });
        });

        let predictedType = types.reduce((a, b) => scores[a] > scores[b] ? a : b);
        if (predictedType === p.CorrectType) totalCorrect++;
    });

    const accuracy = (totalCorrect / testPokemon.length) * 100;

    // 2. UI Update
    const display = document.getElementById('zone2-stats-results');
    display.innerHTML = `
        <div style="background: white; padding: 10px; border-radius: 8px; margin-top:10px; border: 1px solid #2196f3;">
            <p>✅ Master Plan Analyzed!</p>
            <p><strong>Total Accuracy: ${accuracy.toFixed(1)}%</strong></p>
        </div>
    `;

    // 3. UNLOCK Step 2
    z2StatsDone = true;
    document.getElementById('single-test-zone2').classList.remove('locked');
}

// Add this mapping object at the top of your script or inside the function
// 1. Data Mapping (Using your specific filenames)
const zone3Data = {
    fire: { pure: "fireb.png", noisy: "firea.png", emoji: '🔥' },
    water: { pure: "watera.png", noisy: "waterb.png", emoji: '💧' },
    grass: { pure: "grassb.png", noisy: "grassa.png", emoji: '🍃' },
    dragon: { pure: "dragonb.png", noisy: "dragona.png", emoji: '🐉' }
};

// 2. Track the results silently
let userZone3Results = []; 

function loadZone3Challenge() {
    const typesArray = Object.keys(zone3Data); // ['fire', 'water', 'grass', 'dragon']
    const currentType = typesArray[zone3Step];
    const data = zone3Data[currentType];
    
    // Update Progress UI
    document.getElementById('zone3-progress').textContent = `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Type (${zone3Step + 1}/4)`;
    document.getElementById('zone3-progress-bar').style.width = `${((zone3Step + 1) / 4) * 100}%`;
    document.getElementById('zone3-feedback').innerHTML = ''; 

    // Randomize A/B
    const isPureLeft = Math.random() > 0.5;
    const leftImg = isPureLeft ? data.pure : data.noisy;
    const rightImg = isPureLeft ? data.noisy : data.pure;

    document.getElementById('zone3-challenge').innerHTML = `
        <h3 style="text-align: center; margin: 20px 0; color:#333;">
            Level ${zone3Step + 1}: Which package is the <strong>Clean (Pure)</strong> ${currentType} data?
        </h3>
        <div class="package-comparison">
            <div class="package-option" onclick="collectZone3Answer(${isPureLeft})">
                <img src="${leftImg}" style="width:100%; border-radius:10px;">
                <h3>📦 Package A</h3>
            </div>
            <div class="package-option" onclick="collectZone3Answer(${!isPureLeft})">
                <img src="${rightImg}" style="width:100%; border-radius:10px;">
                <h3>📦 Package B</h3>
            </div>
        </div>`;
}

// 3. New function to collect answers without feedback
function collectZone3Answer(isCorrect) {
    const typesArray = Object.keys(zone3Data);
    const currentType = typesArray[zone3Step];

    // Store the result for this type
    userZone3Results.push({
        type: currentType,
        correct: isCorrect,
        emoji: zone3Data[currentType].emoji
    });

    zone3Step++;

    if (zone3Step < 4) {
        // Move to next type silently
        loadZone3Challenge();
    } else {
        // All 4 done! Show the big reveal
        showZone3FinalResults();
    }
}

// 4. The Final Reveal Function
function showZone3FinalResults() {
    let resultsHTML = `
        <h2 style="text-align:center; margin-bottom:20px;">🕵️‍♂️ Lab 3 Results Reveal!</h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
    `;

    userZone3Results.forEach(res => {
        const statusClass = res.correct ? 'success' : 'error';
        const statusIcon = res.correct ? '✅ PURE' : '❌ NOISY';
        
        resultsHTML += `
            <div class="feedback ${statusClass}" style="margin:0; padding:15px;">
                <span style="font-size:1.5em;">${res.emoji}</span><br>
                <strong>${res.type.toUpperCase()}</strong><br>
                <span style="font-size:1.2em;">${statusIcon}</span>
            </div>
        `;
    });

    resultsHTML += `</div>`;

    // Calculate total score
    const correctCount = userZone3Results.filter(r => r.correct).length;
    resultsHTML += `
        <div style="text-align:center; margin-top:30px;">
            <h3>Final Score: ${correctCount} / 4</h3>
            <p>${correctCount === 4 ? "Master Researcher! All pure data found." : "Good try! Some noisy data snuck in."}</p>
        </div>
    `;

    document.getElementById('zone3-challenge').innerHTML = resultsHTML;
    document.getElementById('zone3-complete').style.display = 'inline-block';
}

function checkZone3Answer(isCorrect) {
    const feedback = document.getElementById('zone3-feedback');
    if (isCorrect) {
        feedback.innerHTML = '<div class="feedback success">✅ Correct! That was the pure package. Moving to next type...</div>';
        setTimeout(() => {
            zone3Step++;
            if (zone3Step < 4) {
                loadZone3Challenge();
                feedback.innerHTML = '';
            } else {
                feedback.innerHTML = '<div class="feedback success">🎉 Excellent! You found all pure packages!</div>';
                document.getElementById('zone3-complete').style.display = 'inline-block';
            }
        }, 2000);
    } else {
        feedback.innerHTML = '<div class="feedback error">❌ Not quite. Look at the patterns more carefully and try again!</div>';
    }
}

function selectDataset(datasetId) {
    const index = zone4Selections.indexOf(datasetId);
    
    if (index > -1) {
        // Deselect if already selected
        zone4Selections.splice(index, 1);
    } else {
        // Add selection (Max 4)
        if (zone4Selections.length >= 4) {
            alert("You can select a maximum of 4 packages!");
            return;
        }
        zone4Selections.push(datasetId);
    }
    updateZone4UI();
}

function updateZone4UI() {
    document.getElementById('selected-count').textContent = zone4Selections.length;
    
    // Visual update
    document.querySelectorAll('.dataset-card').forEach(card => {
        const id = card.dataset.dataset;
        card.classList.toggle('selected', zone4Selections.includes(id));
    });

    // Enable button if at least 1 package is selected (1-4 range)
    const trainBtn = document.getElementById('zone4-train');
    trainBtn.disabled = zone4Selections.length === 0;
    
    // Optional: Change button text based on selection
    if (zone4Selections.length === 0) {
        trainBtn.innerText = "Select at least 1 package";
    } else {
        trainBtn.innerText = "🚀 Train AI & See Weights";
    }
}

function trainZone4() {
    // 1. Combine Data from Selected Packages
    let trainingData = [];
    
    zone4Selections.forEach(id => {
        const dataset = availableDatasets[id];
        if (dataset) {
            trainingData = trainingData.concat(dataset.data);
        }
    });

    if (trainingData.length === 0) return;

    // 2. Calculate Averages (Machine Learning)
    // We calculate the average value for each feature for each type based on the provided data
    const learnedWeights = {}; 
    const sums = {}; 
    const counts = {};

    // Initialize accumulators
    types.forEach(t => { 
        sums[t] = {}; 
        counts[t] = 0; 
        features.forEach(f => sums[t][f.id] = 0); 
    });

    // Sum up stats from the training data
    trainingData.forEach(p => { 
        const t = p.CorrectType; 
        if (sums[t]) { // Only process known types
            counts[t]++; 
            features.forEach(f => sums[t][f.id] += p[f.id]); 
        }
    });

    // Calculate Average Weights (Mapping 0-10 scale to -3 to +3 for LEDs)
    types.forEach(t => { 
        learnedWeights[t] = {}; 
        features.forEach(f => { 
            // If we have data for this type, calc average. If not, default to 5 (neutral).
            const avg = counts[t] > 0 ? sums[t][f.id] / counts[t] : 5; 
            
            // Formula: (Average - 5) / 1.66  -> Maps 0..10 to approx -3..+3
            if (f.id === 'HasWings') {
            // Map 0..1 range to -3..+3 range
            // If avg > 0.5 (Mostly wings) -> +3
            // If avg < 0.5 (Mostly no wings) -> -3
            learnedWeights[t][f.id] = avg > 0.5 ? 3 : -3;
        } else {
            // Normal math for 0-10 stats
            learnedWeights[t][f.id] = Math.max(-3, Math.min(3, Math.round((avg - 5) / 1.66))); 
        }
        }); 
    });

    currentLearnedWeights = learnedWeights;

    // 3. Show on LED Board
    showLearnedWeights(learnedWeights);

    // 4. Test against the Test Set (25 Fire + others)
    let totalCorrect = 0;
    const typeResults = { fire: 0, water: 0, grass: 0, dragon: 0 };
    
    testPokemon.forEach(p => {
        const scores = {};
        
        // Calculate scores
        types.forEach(t => {
            scores[t] = 0;
            features.forEach(f => {
                let val = p[f.id];
                
                // ✅✅✅ ADD THIS FIX HERE ✅✅✅
                // Map Wings (0/1) to (0/10) so the math works correctly
                if (f.id === 'HasWings') {
                    val = val === 1 ? 10 : 0;
                }
                // ✅✅✅ END FIX ✅✅✅

                // Now (10 - 5) * 3 = +15 points!
                scores[t] += (val - 5) * learnedWeights[t][f.id];
            });
        });

        // Find winner
        let maxScore = -Infinity;
        let predictedType = 'fire'; // Default fallback
        
        types.forEach(t => { 
            if (scores[t] > maxScore) { 
                maxScore = scores[t]; 
                predictedType = t; 
            } 
        });

        if (predictedType === p.CorrectType) { 
            totalCorrect++; 
            typeResults[p.CorrectType]++; 
        }
    });
    
    // 5. Display Results
    const accuracy = (totalCorrect / testPokemon.length) * 100;
    const typeEmojis = { fire: '🔥', water: '💧', grass: '🍃', dragon: '🐉' };
    
    const resultsPanel = document.getElementById('zone4-results');
    resultsPanel.classList.add('show');
    
    resultsPanel.innerHTML = `<h1><span class="emoji">📊</span> Final Model Performance</h3><div class="stats-grid">` + 
        types.map(type => `
        <div class="stat-card">
            <div class="stat-value">${(typeResults[type]/25 * 100).toFixed(1)}%</div>
            <div class="stat-label">${typeEmojis[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} Accuracy</div>
        </div>`).join('') + `
        <div class="stat-card" style="grid-column: span 2">
            <div class="stat-value">${accuracy.toFixed(1)}%</div>
            <div class="stat-label">Overall Model Accuracy</div>
        </div>
    </div>`;
    document.getElementById('zone4-single-test').style.display = 'block';
    document.getElementById('zone4-complete').style.display = 'inline-block';
}

function switchZone(zoneNum) {
    // 1. Remove active classes from containers and buttons
    document.querySelectorAll('.zone-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.zone-btn').forEach(el => el.classList.remove('active'));
    
    // 2. Set the new background image (Make sure extensions like .png or .jpg match your files)
    document.body.style.backgroundImage = `url('lab${zoneNum}.jpg')`;

    // 3. Activate the new zone container and button
    const activeZone = document.getElementById(`zone${zoneNum}`);
    activeZone.classList.add('active');
    document.getElementById(`zone${zoneNum}-btn`).classList.add('active');

    // 4. Move the LED board to the current zone
    const ledBoard = document.getElementById('led-board');
    const targetSlot = activeZone.querySelector('.led-slot');
    if (ledBoard && targetSlot) {
        targetSlot.appendChild(ledBoard);
    }

    currentZone = zoneNum;
    updateLedBoard();
    
    // Zone 3 specific logic
    if (zoneNum === 3 && zone3Step === 0) { 
        loadZone3Challenge(); 
    }
}

function resetZone(zone) {
    if (zone === 1) {
        zone1Rules = [null, null, null, null];
        document.querySelectorAll('#zone1-slots .rule-slot').forEach((slot, i) => { slot.innerHTML = `Drop Feature ${i + 1}`; slot.classList.remove('filled'); });
        document.getElementById('zone1-results').classList.remove('show');
        document.getElementById('zone1-complete').style.display = 'none';
        updateLedBoard();
    } else if (zone === 2) {
        zone2Rules = { fire: [], water: [], grass: [], dragon: [] };
        document.querySelectorAll('#zone2 .rule-slot').forEach(slot => { slot.innerHTML = `<div class="slot-label">${slot.querySelector('.slot-label').innerHTML}</div>`; slot.classList.remove('filled'); });
        document.getElementById('zone2-results').classList.remove('show');
        document.getElementById('zone2-complete').style.display = 'none';
        updateLedBoard();
    } else if (zone === 4) {
        zone4Selections = [];
        updateZone4UI();
        document.getElementById('zone4-results').classList.remove('show');
        document.getElementById('zone4-complete').style.display = 'none';
        clearLedBoard();
    }
}

function completeZone(zone) {
    document.getElementById(`zone${zone + 1}-btn`).disabled = false;
    switchZone(zone + 1);
}

function completeJourney() {
    // alert("🎉 Congratulations! ..."); // <-- Remove or comment this out
    
    // Enable Zone 5 button
    document.getElementById('zone5-btn').disabled = false;
    switchZone(5);
}
const zoneHints = {
    1: [
        "Not sure where to start? Look at Guidebook — it shows what makes a Pokémon a Fire type. You can test your plan and try again if it doesn’t work!",
        "Look at which Pokémon are not Fire types — if your plan catches them too, there might be a conflict! Try removing or changing one clue to fix it.",
        "You can pick 1 to 4 Clue Cards for your plan. Do you think using more cards always makes it better? Try and see!"
    ],
    2: [
        "Look at Guidebook! Since the Dragon page is broken, use your imagination for dragons. If a clue isn’t clearly high or low for that type, it might not be needed in that plan.",
        "Because order matters now, put the most important clue first — it’s usually the one that makes this Pokémon type special!",
        "If two types share the same clue, make a trade-off. You can put that clue last in both plans, or keep it in one and remove it from the other. Try both ways and see what works best!"
    ],
    4: [
        "The safest way is to include one pure package for each type, keep everything balanced.",
        "The Big Clear Mix package covers all types at once — maybe it’s a smart shortcut?",
        "Even with the same combo, you might get different grades — can you guess why?"
    ]
};

let hintIndices = { 1: 0, 2: 0, 4: 0 };

function showNextHint(zoneId) {
    const box = document.getElementById(`zone${zoneId}-hint-box`);
    const textSpan = document.getElementById(`zone${zoneId}-hint-text`);
    const counterSpan = document.getElementById(`zone${zoneId}-hint-counter`);
    
  
    if (box.style.display !== 'block') {
        box.style.display = 'block';
    }


    let index = hintIndices[zoneId];
    const hints = zoneHints[zoneId];

  
    textSpan.textContent = hints[index];
    counterSpan.textContent = `Hint ${index + 1} of ${hints.length} (Click button for next)`;

 
    hintIndices[zoneId] = (index + 1) % hints.length;
}

function runSingleTest() {
    if (!z1StatsDone) return;
    // 1. Validation
    const activeRules = zone1Rules.filter(r => r !== null);
    if (activeRules.length === 0) {
        alert("Please drag at least one Feature Card into the slots first!");
        return;
    }

    const boxContainer = document.querySelector('.mystery-box-container');
    const box = document.querySelector('.mystery-box');
    const resultPanel = document.getElementById('single-test-result');

    // 2. Trigger Shake Animation
    box.classList.add('shaking');

    // 3. Wait for shake (500ms), then calculate and reveal
    setTimeout(() => {
        box.classList.remove('shaking');
        boxContainer.style.display = 'none'; // Hide box
        resultPanel.style.display = 'block'; // Show result container

        // --- CALCULATION LOGIC (Same as before) ---
        const p = testPokemon[Math.floor(Math.random() * testPokemon.length)];
        let allRulesPassed = true;
        let logicRowsHTML = "";

        activeRules.forEach((rule, index) => {
            const featureObj = features.find(f => f.id === rule.feature);
            let pokeValueRaw = p[rule.feature];
            let pokeValueBinary = (rule.feature === 'HasWings') ? pokeValueRaw : (pokeValueRaw > 5 ? 1 : 0);
            
            const requiredBinary = rule.state === 'high' ? 1 : 0;
            const isMatch = pokeValueBinary === requiredBinary;
            if (!isMatch) allRulesPassed = false;

            const ruleText = rule.state === 'high' ? featureObj.high : featureObj.low;
            let pokeStatText = "";
            if (rule.feature === 'HasWings') {
                pokeStatText = pokeValueRaw === 1 ? "Has Wings" : "No Wings";
            } else {
                const stateText = pokeValueBinary === 1 ? "High" : "Low";
                pokeStatText = `${featureObj.name}: ${pokeValueRaw} (${stateText})`;
            }

            // Note the 'reveal-item' and 'delay' classes added here
            logicRowsHTML += `
                <tr class="reveal-item delay-${index + 3}">
                    <td><strong>Rule ${index + 1}:</strong> ${ruleText}</td>
                    <td>${pokeStatText}</td>
                    <td class="match-icon ${isMatch ? 'match-pass' : 'match-fail'}">
                        ${isMatch ? '✅ Pass' : '❌ Fail'}
                    </td>
                </tr>
            `;
        });

        const prediction = allRulesPassed ? 'fire' : 'not fire';
        const actualType = p.CorrectType;
        const isCorrectDecision = (prediction === 'fire' && actualType === 'fire') || 
                                  (prediction === 'not fire' && actualType !== 'fire');

        let verdictHTML = "";
        let typeColor = actualType === 'fire' ? '#ff5722' : 
                        actualType === 'water' ? '#2196f3' : 
                        actualType === 'grass' ? '#4caf50' : '#673ab7';

        if (isCorrectDecision) {
            verdictHTML = `<div class="final-verdict verdict-success verdict-stamp delay-final">
                🤖 AI Prediction: <strong>${prediction.toUpperCase()}</strong><br>
                ✅ Correct! It is <strong>${actualType.toUpperCase()}</strong>.
            </div>`;
        } else {
            verdictHTML = `<div class="final-verdict verdict-fail verdict-stamp delay-final">
                🤖 AI Prediction: <strong>${prediction.toUpperCase()}</strong><br>
                ❌ Mistake. It is actually <strong>${actualType.toUpperCase()}</strong>.
            </div>`;
        }

        // 4. Render with Animation Classes
        resultPanel.innerHTML = `
            <div class="single-test-grid">
                <!-- Left: Pokemon Card (Appears 1st) -->
                <div class="poke-detail-card reveal-item delay-1">
                    <div style="font-size:3em; margin-bottom:10px;">
                        ${getEmojiForType(p.CorrectType)}
                    </div>
                    <h3>${p.name}</h3>
                    <div class="poke-type-badge" style="background:${typeColor}">
                        ${p.CorrectType.toUpperCase()}
                    </div>
                </div>

                <!-- Right: Logic Table (Rows appear 2nd, 3rd...) -->
                <div>
                    <table class="logic-table">
                        <thead class="reveal-item delay-2">
                            <tr>
                                <th>Your Rule</th>
                                <th>Pokémon Stat</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logicRowsHTML}
                        </tbody>
                    </table>
                    ${verdictHTML}
                    
                    <!-- Retry Button -->
                    <div class="reveal-item delay-final" style="text-align:center">
                        <button class="btn-retry-small" onclick="resetSingleTest()">🔄 Test Another Pokémon</button>
                    </div>
                </div>
            </div>
        `;

    }, 500); // End of setTimeout

    z1SingleCount++;
    document.getElementById('z1-count').innerText = z1SingleCount;

    if (z1SingleCount >= 3) {
        document.getElementById('zone1-complete').style.display = 'inline-block';
        // Auto-scroll to button
        document.getElementById('zone1-complete').scrollIntoView({behavior: "smooth"});
    }
}

// Helper to reset the view
function resetSingleTest() {
    const boxContainer = document.querySelector('.mystery-box-container');
    const resultPanel = document.getElementById('single-test-result');
    
    resultPanel.style.display = 'none';
    boxContainer.style.display = 'flex'; // Show box again
    
    // Reset animation on box for next time
    const box = document.querySelector('.mystery-box');
    box.style.animation = 'none';
    box.offsetHeight; /* trigger reflow */
    box.style.animation = null; 
}

// Helper for Emojis
function getEmojiForType(type) {
    if (type === 'fire') return '🔥';
    if (type === 'water') return '💧';
    if (type === 'grass') return '🍃';
    if (type === 'dragon') return '🐉';
    return '❓';
}

// --- Zone 2 Single Test Logic ---

function runSingleTestZone2() {
    // 1. Validation: Check if any rules are set
    // We check if at least one rule slot in 'fire' is filled as a proxy
    if (zone2Rules['fire'].every(r => r === null)) {
        alert("Please set up your Master Plan rules first!");
        return;
    }

    const boxContainer = document.querySelector('.zone2-box-container');
    const box = boxContainer.querySelector('.mystery-box');
    const resultPanel = document.getElementById('single-test-result-zone2');

    // 2. Animation
    box.classList.add('shaking');

    setTimeout(() => {
        box.classList.remove('shaking');
        boxContainer.style.display = 'none';
        resultPanel.style.display = 'block';

        // 3. Pick Random Pokemon
        const p = testPokemon[Math.floor(Math.random() * testPokemon.length)];

        // 4. Calculate Scores for ALL types
        const typeScores = { fire: 0, water: 0, grass: 0, dragon: 0 };
        const typeMaxPossible = 8; // 3 + 2 + 2 + 1 = 8 points max

        types.forEach(type => {
            zone2Rules[type].forEach((rule, index) => {
                if (rule) {
                    let pokeValueRaw = p[rule.feature];
                    let pokeValueBinary = (rule.feature === 'HasWings') ? pokeValueRaw : (pokeValueRaw > 5 ? 1 : 0);
                    
                    const requiredBinary = rule.state === 'high' ? 1 : 0;
                    
                    if (pokeValueBinary === requiredBinary) {
                        // Points based on slot index: 0=3pts, 1=2pts, 2=2pts, 3=1pt
                        if (index === 0) typeScores[type] += 3;
                        else if (index === 1 || index === 2) typeScores[type] += 2;
                        else typeScores[type] += 1;
                    }
                }
            });
        });

        // 5. Determine Winner
        let maxScore = -1;
        let predictedType = 'fire'; // Default
        
        const shuffledTypes = shuffleArray([...types]);

        // Sort types by score descending for display
        const sortedTypes = types.slice().sort((a, b) => typeScores[b] - typeScores[a]);
        
        // Prediction is the top one
        predictedType = sortedTypes[0];
        maxScore = typeScores[predictedType];

        const actualType = p.CorrectType;
        const isCorrect = predictedType === actualType;

        // 6. Build HTML
        // Generate Score Rows
        let scoreRowsHTML = "";
        sortedTypes.forEach((type, index) => {
            const score = typeScores[type];
            const isWinner = (type === predictedType);
            const percent = (score / typeMaxPossible) * 100;
            const typeNameCap = type.charAt(0).toUpperCase() + type.slice(1);
            
            scoreRowsHTML += `
                <tr class="${isWinner ? 'row-winner' : ''} reveal-item delay-${index + 2}">
                    <td>
                        <div class="type-label-cell">
                            <span>${getEmojiForType(type)} ${typeNameCap}</span>
                        </div>
                    </td>
                    <td>
                        <div class="score-bar-container">
                            <div class="score-bar-fill bar-${type}" style="width: ${percent}%"></div>
                        </div>
                        <strong>${score} pts</strong>
                    </td>
                </tr>
            `;
        });

        // Generate Verdict
        let verdictHTML = "";
        if (isCorrect) {
            verdictHTML = `<div class="final-verdict verdict-success verdict-stamp delay-final">
                🤖 Highest Score: <strong>${predictedType.toUpperCase()}</strong><br>
                ✅ Correct! It is a ${actualType.toUpperCase()} type.
            </div>`;
        } else {
            verdictHTML = `<div class="final-verdict verdict-fail verdict-stamp delay-final">
                🤖 Highest Score: <strong>${predictedType.toUpperCase()}</strong><br>
                ❌ Mistake. It is actually a <strong>${actualType.toUpperCase()}</strong> type.
            </div>`;
        }

        let actualTypeColor = actualType === 'fire' ? '#ff5722' : 
                              actualType === 'water' ? '#2196f3' : 
                              actualType === 'grass' ? '#4caf50' : '#673ab7';

        resultPanel.innerHTML = `
            <div class="single-test-grid">
                <!-- Left: Pokemon Card -->
                <div class="poke-detail-card reveal-item delay-1">
                    <div style="font-size:3em; margin-bottom:10px;">
                        ${getEmojiForType(p.CorrectType)}
                    </div>
                    <h3>${p.name}</h3>
                    <div class="poke-type-badge" style="background:${actualTypeColor}">
                        ${p.CorrectType.toUpperCase()}
                    </div>
                    <div style="margin-top:15px; font-size:0.85em; color:#666; text-align:left;">
                        <strong>Stats:</strong><br>
                        ${features.map(f => {
                            // Don't show ALL stats, just Wings + 2 random or important ones? 
                            // Actually showing all is fine for debugging/learning
                            let val = p[f.id];
                            if(f.id !== 'HasWings') val += '/10';
                            else val = val ? 'Yes' : 'No';
                            return `${f.name}: ${val}`;
                        }).join('<br>')}
                    </div>
                </div>

                <!-- Right: Score Leaderboard -->
                <div>
                    <h4 style="margin-bottom:10px; color:#555;" class="reveal-item delay-1">🏆 Confidence Scores</h4>
                    <table class="score-table">
                        <tbody>
                            ${scoreRowsHTML}
                        </tbody>
                    </table>
                    ${verdictHTML}
                    
                    <div class="reveal-item delay-final" style="text-align:center">
                        <button class="btn-retry-small" onclick="resetSingleTestZone2()">🔄 Test Another Pokémon</button>
                    </div>
                </div>
            </div>
        `;
        if (z2StatsDone) {
            z2SingleCount++;
            const countSpan = document.getElementById('z2-count');
            if (countSpan) countSpan.innerText = z2SingleCount;

            if (z2SingleCount >= 3) {
                document.getElementById('zone2-complete').style.display = 'inline-block';
                document.getElementById('zone2-complete').scrollIntoView({behavior: "smooth"});
            }
        }                
    }, 500);
}

function resetSingleTestZone2() {
    const boxContainer = document.querySelector('.zone2-box-container');
    const resultPanel = document.getElementById('single-test-result-zone2');
    
    resultPanel.style.display = 'none';
    boxContainer.style.display = 'flex'; 
    
    const box = boxContainer.querySelector('.mystery-box');
    box.style.animation = 'none';
    box.offsetHeight; 
    box.style.animation = null; 
}

// --- Zone 4 Single Test Logic ---

function runSingleTestZone4() {
    // 1. Validation
    if (!currentLearnedWeights) {
        alert("Please train the AI first!");
        return;
    }

    const boxContainer = document.querySelector('.zone4-box-container');
    const box = boxContainer.querySelector('.mystery-box');
    const resultPanel = document.getElementById('single-test-result-zone4');

    // 2. Animation
    box.classList.add('shaking');

    setTimeout(() => {
        box.classList.remove('shaking');
        boxContainer.style.display = 'none';
        resultPanel.style.display = 'block';

        // 3. Pick Random Pokemon
        const p = testPokemon[Math.floor(Math.random() * testPokemon.length)];

        // 4. Calculate Confidence Scores
        const typeScores = { fire: 0, water: 0, grass: 0, dragon: 0 };
        
        // This math must match trainZone4 exactly
        types.forEach(t => {
            typeScores[t] = 0;
            features.forEach(f => {
                let val = p[f.id];
                if (f.id === 'HasWings') {
                    val = val === 1 ? 10 : 0;
                }

                // Now (10 - 5) = +5, so Positive Weight * +5 = Positive Score!
                typeScores[t] += (val - 5) * currentLearnedWeights[t][f.id];
            });
        });

        // 5. Determine Winner
        // Convert to a prettier "Confidence" number (roughly 0 to 100%)
        // Raw scores usually range from -50 to +50. Let's normalize slightly for display.
        const formattedScores = [];
        let maxScore = -Infinity;
        let predictedType = 'fire';

        types.forEach(type => {
            const raw = typeScores[type];
            if (raw > maxScore) {
                maxScore = raw;
                predictedType = type;
            }
            // Simple normalization for visualization (Shift +50 to make positive, cap at 100)
            let visualPercent = Math.max(0, Math.min(100, (raw + 40))); 
            
            formattedScores.push({ type: type, score: raw, percent: visualPercent });
        });

        // Sort for Leaderboard
        formattedScores.sort((a, b) => b.score - a.score);

        const actualType = p.CorrectType;
        const isCorrect = predictedType === actualType;

        // 6. Build HTML
        let scoreRowsHTML = "";
        formattedScores.forEach((item, index) => {
            const isWinner = (item.type === predictedType);
            const typeNameCap = item.type.charAt(0).toUpperCase() + item.type.slice(1);
            
            scoreRowsHTML += `
                <tr class="${isWinner ? 'row-winner' : ''} reveal-item delay-${index + 2}">
                    <td>
                        <div class="type-label-cell">
                            <span>${getEmojiForType(item.type)} ${typeNameCap}</span>
                        </div>
                    </td>
                    <td>
                        <div class="score-bar-container">
                            <div class="score-bar-fill bar-${item.type}" style="width: ${item.percent}%"></div>
                        </div>
                        <strong>${item.score.toFixed(0)}</strong>
                    </td>
                </tr>
            `;
        });

        let verdictHTML = "";
        if (isCorrect) {
            verdictHTML = `<div class="final-verdict verdict-success verdict-stamp delay-final">
                🤖 AI Confidence: <strong>${predictedType.toUpperCase()}</strong><br>
                ✅ Correct! It matches the <strong>${actualType.toUpperCase()}</strong> pattern.
            </div>`;
        } else {
            verdictHTML = `<div class="final-verdict verdict-fail verdict-stamp delay-final">
                🤖 AI Confidence: <strong>${predictedType.toUpperCase()}</strong><br>
                ❌ Mistake. It is actually <strong>${actualType.toUpperCase()}</strong>.<br>
                <span style="font-size:0.85em; font-weight:normal;">(Your training data might be noisy or unbalanced!)</span>
            </div>`;
        }

        let actualTypeColor = actualType === 'fire' ? '#ff5722' : 
                              actualType === 'water' ? '#2196f3' : 
                              actualType === 'grass' ? '#4caf50' : '#673ab7';

        resultPanel.innerHTML = `
            <div class="single-test-grid">
                <!-- Left: Pokemon Card -->
                <div class="poke-detail-card reveal-item delay-1">
                    <div style="font-size:3em; margin-bottom:10px;">
                        ${getEmojiForType(p.CorrectType)}
                    </div>
                    <h3>${p.name}</h3>
                    <div class="poke-type-badge" style="background:${actualTypeColor}">
                        ${p.CorrectType.toUpperCase()}
                    </div>
                    <div style="margin-top:15px; font-size:0.85em; color:#666; text-align:left;">
                        <strong>Stats:</strong><br>
                        ${features.map(f => {
                            let val = p[f.id];
                            if(f.id !== 'HasWings') val += '/10';
                            else val = val ? 'Yes' : 'No';
                            return `${f.name}: ${val}`;
                        }).join('<br>')}
                    </div>
                </div>

                <!-- Right: Score Leaderboard -->
                <div>
                    <h4 style="margin-bottom:10px; color:#555;" class="reveal-item delay-1">🧠 Model Logic Scores</h4>
                    <table class="score-table">
                        <tbody>
                            ${scoreRowsHTML}
                        </tbody>
                    </table>
                    ${verdictHTML}
                    
                    <div class="reveal-item delay-final" style="text-align:center">
                        <button class="btn-retry-small" onclick="resetSingleTestZone4()">🔄 Test Another</button>
                    </div>
                </div>
            </div>
        `;

    }, 500);
}

function resetSingleTestZone4() {
    const boxContainer = document.querySelector('.zone4-box-container');
    const resultPanel = document.getElementById('single-test-result-zone4');
    
    resultPanel.style.display = 'none';
    boxContainer.style.display = 'flex'; 
    
    const box = boxContainer.querySelector('.mystery-box');
    box.style.animation = 'none';
    box.offsetHeight; 
    box.style.animation = null; 
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Zone 5: Boss Battle Logic ---

// Hardcoded Boss Data from your prompt
const bosses = [
    { 
        name: "Guardian 1", 
        CorrectType: "fire",
        // Stats: Speed, Attack, Defense, Wings, Altitude, Temp
        HasWings: 1, Speed: 8, Attack: 6, Defense: 8, HabitatAltitude: 6, HabitatTemperature: 9 
    },
    { 
        name: "Guardian 2", 
        CorrectType: "water",
        HasWings: 1, Speed: 8, Attack: 3, Defense: 8, HabitatAltitude: 2, HabitatTemperature: 3 
    },
    { 
        name: "Guardian 3", 
        CorrectType: "grass",
        HasWings: 0, Speed: 2, Attack: 8, Defense: 2, HabitatAltitude: 6, HabitatTemperature: 3 
    }
];

let currentBossIndex = 0;

function startBossBattle() {
    // Validation
    if (zone2Rules.fire.every(r => r === null)) {
        alert("You must complete Zone 2 (Rules) first!");
        switchZone(2);
        return;
    }
    if (!currentLearnedWeights) {
        alert("You must complete Zone 4 (Training) first!");
        switchZone(4);
        return;
    }

    document.getElementById('start-boss-btn').style.display = 'none';
    document.getElementById('boss-battle-area').style.display = 'block';
    
    loadBoss(0);
}

function loadBoss(index) {
    currentBossIndex = index;
    const boss = bosses[index];
    const bossNum = index + 1;

    // 1. Reset UI
    document.getElementById('zone5-feedback').style.display = 'none';
    document.getElementById('next-boss-btn').style.display = 'none';
    document.querySelectorAll('.bot-card').forEach(el => {
        el.classList.remove('bot-winner', 'bot-loser');
        el.querySelector('button').disabled = false;
    });

    // 2. Render Boss Card
    document.getElementById('boss-name').innerText = `${boss.name} (Boss ${bossNum}/3)`;
    
    const wingsIcon = boss.HasWings ? '🦅 Yes' : '🚫 No';
    document.getElementById('boss-stats-display').innerHTML = `
        <div><span>⚡ Speed:</span> <strong>${boss.Speed}</strong></div>
        <div><span>⚔️ Attack:</span> <strong>${boss.Attack}</strong></div>
        <div><span>🛡️ Defense:</span> <strong>${boss.Defense}</strong></div>
        <div><span>🦅 Wings:</span> <strong>${wingsIcon}</strong></div>
        <div><span>🏔️ Altitude:</span> <strong>${boss.HabitatAltitude}</strong></div>
        <div><span>🌡️ Temp:</span> <strong>${boss.HabitatTemperature}</strong></div>
    `;

    // 3. Run RuleBot (Rules)
    const RuleBotResult = getRuleBotPrediction(boss);
    document.getElementById('RuleBot-reasoning').innerHTML = RuleBotResult.reasoning;
    document.getElementById('RuleBot-prediction').innerHTML = 
        `${getEmojiForType(RuleBotResult.prediction)} ${RuleBotResult.prediction.toUpperCase()}`;
    // Store for validation
    document.querySelector('.RuleBot').dataset.prediction = RuleBotResult.prediction;

    // 4. Run DataBot (AI)
    const DataBotResult = getDataBotPrediction(boss);
    document.getElementById('DataBot-reasoning').innerHTML = DataBotResult.reasoning;
    document.getElementById('DataBot-prediction').innerHTML = 
        `${getEmojiForType(DataBotResult.prediction)} ${DataBotResult.prediction.toUpperCase()}`;
    // Store for validation
    document.querySelector('.DataBot').dataset.prediction = DataBotResult.prediction;
}

// Logic reuse from Zone 2
function getRuleBotPrediction(p) {
    const scores = { fire: 0, water: 0, grass: 0, dragon: 0 };
    let details = "";

    // Shuffle for tie breaking
    const shuffledTypes = shuffleArray([...types]); 

    shuffledTypes.forEach(type => {
        zone2Rules[type].forEach((rule, i) => {
            if (rule) {
                let pokeValue = p[rule.feature];
                if (rule.feature !== 'HasWings') pokeValue = pokeValue > 5 ? 1 : 0;
                const ruleValue = rule.state === 'high' ? 1 : 0;
                
                if (pokeValue === ruleValue) {
                    const points = (i === 0) ? 3 : (i < 3 ? 2 : 1);
                    scores[type] += points;
                }
            }
        });
    });

    // Find winner
    let maxScore = -1;
    let predicted = 'fire';
    shuffledTypes.forEach(t => { 
        if (scores[t] > maxScore) { maxScore = scores[t]; predicted = t; } 
    });

    return {
        prediction: predicted,
        reasoning: `I followed your rule order.<br>Best match: <strong>${predicted}</strong> (${maxScore} pts).`
    };
}

// Logic reuse from Zone 4
function getDataBotPrediction(p) {
    const scores = { fire: 0, water: 0, grass: 0, dragon: 0 };
    
    // Shuffle for tie breaking
    const shuffledTypes = shuffleArray([...types]); 

    shuffledTypes.forEach(t => {
        features.forEach(f => {
            let val = p[f.id];
            if(f.id === 'HasWings') val = val === 1 ? 10 : 0;
            scores[t] += (val - 5) * currentLearnedWeights[t][f.id];
        });
    });

    let maxScore = -Infinity;
    let predicted = 'fire';
    shuffledTypes.forEach(t => { 
        if (scores[t] > maxScore) { maxScore = scores[t]; predicted = t; } 
    });

    // Normalize score for display
    let visualScore = Math.round(maxScore); 

    return {
        prediction: predicted,
        reasoning: `My calculations show high confidence for <strong>${predicted}</strong> (Score: ${visualScore}).`
    };
}

function trustBot(botName) {
    const boss = bosses[currentBossIndex];
    const card = document.querySelector(`.${botName}`);
    const prediction = card.dataset.prediction;
    
    const isCorrect = prediction === boss.CorrectType;
    const feedback = document.getElementById('zone5-feedback');
    feedback.style.display = 'block';

    // Disable buttons
    document.querySelectorAll('.bot-card button').forEach(b => b.disabled = true);

    if (isCorrect) {
        feedback.className = 'feedback success';
        feedback.innerHTML = `✅ Correct! You trusted the right bot. The Guardian is indeed <strong>${boss.CorrectType.toUpperCase()}</strong>.`;
        card.classList.add('bot-winner');
    } else {
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ Oh no! That bot was wrong. The Guardian was actually <strong>${boss.CorrectType.toUpperCase()}</strong>.`;
        card.classList.add('bot-loser');
    }

    // Show Next button
    const nextBtn = document.getElementById('next-boss-btn');
    if (currentBossIndex < bosses.length - 1) {
        nextBtn.innerText = `⚔️ Summon Guardian ${currentBossIndex + 2}`;
        nextBtn.style.display = 'inline-block';
    } else {
        nextBtn.innerText = "🏆 Finish Game";
        nextBtn.onclick = () => { alert("🌟 You have become a Pokémon AI Master! Thanks for playing."); location.reload(); };
        nextBtn.style.display = 'inline-block';
    }
}

function nextBoss() {
    loadBoss(currentBossIndex + 1);
}

// --- Guidebook Logic ---
function openGuidebook() {
    document.getElementById('guidebook-modal').style.display = 'block';
}

function closeGuidebook() {
    document.getElementById('guidebook-modal').style.display = 'none';
}

const guidePages = [
    { title: "🔥 Fire Type Analysis", img: "fire.png" },
    { title: "💧 Water Type Analysis", img: "water.png" },
    { title: "🍃 Grass Type Analysis", img: "grass.png" },
    { title: "🐉 Dragon Type Analysis", img: "dragon.png" }
];

let currentGuideIndex = 0;

// --- Zone 2 Individual Reset Logic ---
function resetZone2Type(type) {
    // 1. Reset data model for this specific type
    zone2Rules[type] = [null, null, null, null];

    // 2. Find the container for this type
    const typeSection = document.querySelector(`.type-section.${type}`);
    
    // 3. Reset the visual slots inside this section
    const slots = typeSection.querySelectorAll('.rule-slot');
    
    slots.forEach((slot, index) => {
        // Remove active classes
        slot.classList.remove('filled', 'low-state');
        
        // Remove click handlers (clone node to strip events)
        const newSlot = slot.cloneNode(true);
        slot.parentNode.replaceChild(newSlot, slot);
        
        // Restore label text based on index
        let labelText = "";
        if (index === 0) labelText = "1st (3pts)";
        else if (index === 1) labelText = "2nd (2pts)";
        else if (index === 2) labelText = "3rd (2pts)";
        else labelText = "4th (1pt)";
        
        newSlot.innerHTML = `<div class="slot-label">${labelText}</div>`;
        
        // Re-attach drop events (because cloneNode removes them)
        newSlot.setAttribute('ondrop', `dropFeature(event, 2, ${index}, '${type}')`);
        newSlot.setAttribute('ondragover', 'allowDrop(event)');
    });

    // 4. Update LEDs to reflect removal
    updateLedBoard();
}

// Handle Next/Prev clicks
function changeGuidePage(direction) {
    // Calculate new index with wrapping
    currentGuideIndex += direction;

    if (currentGuideIndex >= guidePages.length) {
        currentGuideIndex = 0; // Wrap to start
    } else if (currentGuideIndex < 0) {
        currentGuideIndex = guidePages.length - 1; // Wrap to end
    }

    updateGuideView();
}

// Update the DOM elements
function updateGuideView() {
    const page = guidePages[currentGuideIndex];
    
    // Update Title
    document.getElementById('guide-title').innerText = page.title;
    
    // Update Image Source
    document.getElementById('guide-img').src = page.img;
    
    // Update Page Counter
    document.getElementById('guide-page-num').innerText = `Page ${currentGuideIndex + 1} of ${guidePages.length}`;
}

// Close modal if clicking outside (keeping this from previous code)
window.onclick = function(event) {
    const modal = document.getElementById('guidebook-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}