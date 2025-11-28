async function loadGameData() {
    try {
        const [testData, trainingData] = await Promise.all([
            fetch('testPokemon.json').then(res => {
                if (!res.ok) throw new Error(`Failed to load testPokemon.json: ${res.statusText}`);
                return res.json();
            }),
            fetch('trainingPokemonPool.json').then(res => {
                if (!res.ok) throw new Error(`Failed to load trainingPokemonPool.json: ${res.statusText}`);
                return res.json();
            })
        ]);

        return {
            testPokemon: testData,
            trainingPokemonPool: trainingData
        };
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Error loading game data! Please ensure you are running this file via a local server (e.g., Live Server in VS Code) and not opening the HTML file directly. Check console for details.");
        return null;
    }
}