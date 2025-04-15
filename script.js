document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const modeSelect = document.getElementById('modeSelect');
    const numProcessesInput = document.getElementById('numProcesses');
    const numResourcesInput = document.getElementById('numResources');
    const createMatricesButton = document.getElementById('createMatrices');
    const detectDeadlockButton = document.getElementById('detectDeadlock');
    const resetButton = document.getElementById('reset');
    const exportScenarioButton = document.getElementById('exportScenario');
    const importScenarioButton = document.getElementById('importScenario');
    const scenarioImportModal = document.getElementById('scenarioImportModal');
    const confirmImportButton = document.getElementById('confirmImport');
    const scenarioImportText = document.getElementById('scenarioImportText');
    const closeModalButton = document.querySelector('.close-modal');
    const matricesDiv = document.getElementById('matrices');
    const resultDiv = document.getElementById('result');
    const stepsContainer = document.getElementById('steps-container');
    const stepsVisualization = document.getElementById('steps-visualization');
    const maxSection = document.getElementById('maxSection');
    const allocatedSection = document.getElementById('allocatedSection');
    const requestedSection = document.getElementById('requestedSection');
    const availableSection = document.getElementById('availableSection');

    // Helper function to get matrix values
    function getMatrixValues() {
        const numProcesses = parseInt(numProcessesInput.value);
        const numResources = parseInt(numResourcesInput.value);
        const mode = modeSelect.value;
        
        const max = [];
        const allocated = [];
        const requested = [];
        const available = [];
        
        // Collect max resources (Multi mode only)
        if (mode === 'multi') {
            for (let i = 0; i < numProcesses; i++) {
                const processMax = [];
                for (let j = 0; j < numResources; j++) {
                    processMax.push(parseInt(document.getElementById(`max-${i}-${j}`).value) || 0);
                }
                max.push(processMax);
            }
        }
        
        // Collect allocated resources
        for (let i = 0; i < numProcesses; i++) {
            const processAllocated = [];
            for (let j = 0; j < numResources; j++) {
                processAllocated.push(parseInt(document.getElementById(`allocated-${i}-${j}`).value) || 0);
            }
            allocated.push(processAllocated);
        }
        
        // Collect requested resources (Single mode only)
        if (mode === 'single') {
            for (let i = 0; i < numProcesses; i++) {
                const processRequested = [];
                for (let j = 0; j < numResources; j++) {
                    processRequested.push(parseInt(document.getElementById(`requested-${i}-${j}`).value) || 0);
                }
                requested.push(processRequested);
            }
        }
        
        // Collect available resources
        for (let j = 0; j < numResources; j++) {
            available.push(parseInt(document.getElementById(`available-${j}`).value) || 0);
        }
        
        return { max, allocated, requested, available };
    }

    // Display result function
    function displayResult(result) {
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const resultHTML = `
            <div class="result-card ${result.isDeadlock ? 'deadlock' : 'safe'}">
                <h2>${result.isDeadlock ? '🚨 Deadlock Detected!' : '✅ No Deadlock'}</h2>
                ${result.isDeadlock ? 
                    `<p>Processes ${result.deadlockedProcesses.map(p => `P${p}`).join(', ')} are in a deadlock.</p>` : 
                    '<p>The system is in a safe state. No deadlock detected.</p>'
                }
            </div>
        `;
        resultDiv.innerHTML = resultHTML;
    }

    // Create matrix input tables dynamically
    function createDynamicTable(tableId, rows, columns, prefix) {
        const table = document.getElementById(tableId);
        table.innerHTML = '';

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Process</th>' + 
            Array.from({length: columns}, (_, j) => `<th>R${j}</th>`).join('');
        table.appendChild(headerRow);

        for (let i = 0; i < rows; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>P${i}</td>` + 
                Array.from({length: columns}, (_, j) => 
                    `<td><input type="number" min="0" id="${prefix}-${i}-${j}" value="0"></td>`
                ).join('');
            table.appendChild(row);
        }
    }

    // Create matrix tables based on user input
    createMatricesButton.addEventListener('click', () => {
        const numProcesses = parseInt(numProcessesInput.value);
        const numResources = parseInt(numResourcesInput.value);
        const mode = modeSelect.value;
        
        if (numProcesses > 0 && numResources > 0) {
            // Common matrices
            createDynamicTable('allocatedTable', numProcesses, numResources, 'allocated');
            createDynamicTable('availableTable', numResources, 1, 'available');
            const availableTable = document.getElementById('availableTable');
            availableTable.innerHTML = '<tr><th>Resource</th><th>Available</th></tr>' +
                Array.from({length: numResources}, (_, j) => 
                    `<tr><td>R${j}</td><td><input type="number" min="0" id="available-${j}" value="0"></td></tr>`
                ).join('');

            // Mode-specific matrices
            if (mode === 'single') {
                createDynamicTable('requestedTable', numProcesses, numResources, 'requested');
                requestedSection.classList.remove('hidden');
                maxSection.classList.add('hidden');
            } else { // multi
                createDynamicTable('maxTable', numProcesses, numResources, 'max');
                maxSection.classList.remove('hidden');
                requestedSection.classList.add('hidden');
            }
            
            matricesDiv.classList.remove('hidden');
            resultDiv.classList.add('hidden');
            stepsContainer.classList.add('hidden');
        }
    });

    // Detect deadlock function
    function detectDeadlock() {
        const { max, allocated, requested, available } = getMatrixValues();
        const numProcesses = allocated.length;
        const numResources = available.length;
        const mode = modeSelect.value;
        
        const work = [...available];
        const finish = new Array(numProcesses).fill(false);
        const steps = [];
        
        let progress = true;
        while (progress) {
            progress = false;
            
            for (let i = 0; i < numProcesses; i++) {
                if (finish[i]) continue;
                
                let canFinish = true;
                if (mode === 'single') {
                    // Check if requested resources can be satisfied
                    for (let j = 0; j < numResources; j++) {
                        if (requested[i][j] > work[j]) {
                            canFinish = false;
                            break;
                        }
                    }
                } else { // multi
                    // Calculate need (max - allocated) and check if it can be satisfied
                    const need = max[i].map((m, j) => m - allocated[i][j]);
                    for (let j = 0; j < numResources; j++) {
                        if (need[j] > work[j]) {
                            canFinish = false;
                            break;
                        }
                    }
                }
                
                if (canFinish) {
                    const step = {
                        process: i,
                        request: mode === 'single' ? [...requested[i]] : max[i].map((m, j) => m - allocated[i][j]),
                        allocated: [...allocated[i]],
                        beforeAvailable: [...work],
                        afterAvailable: null,
                        description: `Process P${i} can proceed and release resources.`
                    };
                    
                    finish[i] = true;
                    progress = true;
                    
                    for (let j = 0; j < numResources; j++) {
                        work[j] += allocated[i][j];
                    }
                    
                    step.afterAvailable = [...work];
                    steps.push(step);
                }
            }
        }
        
        const deadlockedProcesses = [];
        for (let i = 0; i < numProcesses; i++) {
            if (!finish[i]) {
                deadlockedProcesses.push(i);
            }
        }
        
        return { 
            isDeadlock: deadlockedProcesses.length > 0,
            deadlockedProcesses,
            steps
        };
    }

    // Visualize steps
    function visualizeSteps(result) {
        stepsVisualization.innerHTML = '';
        
        if (result.isDeadlock) {
            const deadlockMessage = document.createElement('div');
            deadlockMessage.classList.add('deadlock-message');
            deadlockMessage.innerHTML = `
                <div class="alert alert-danger">
                    <h3>🚨 Deadlock Detected!</h3>
                    <p>Processes ${result.deadlockedProcesses.map(p => `P${p}`).join(', ')} are in a deadlock.</p>
                </div>
            `;
            stepsVisualization.appendChild(deadlockMessage);
        }
        
        const timeline = document.createElement('div');
        timeline.classList.add('steps-timeline');
        
        result.steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.classList.add('timeline-step');
            const colors = ['#00b894', '#6c5ce7', '#e84393', '#fd79a8', '#a29bfe'];
            const processColor = colors[step.process % colors.length];
            
            stepElement.innerHTML = `
                <div class="timeline-step-header" style="background-color: ${processColor}">
                    <span class="step-number">Step ${index + 1}</span>
                    <span class="step-process">Process P${step.process}</span>
                </div>
                <div class="timeline-step-content">
                    <div class="step-details">
                        <div class="detail-row">
                            <strong>${modeSelect.value === 'single' ? 'Request' : 'Need'}:</strong>
                            ${step.request.map((r, i) => `R${i}: ${r}`).join(' | ')}
                        </div>
                        <div class="detail-row">
                            <strong>Allocated:</strong>
                            ${step.allocated.map((a, i) => `R${i}: ${a}`).join(' | ')}
                        </div>
                        <div class="detail-row">
                            <strong>Before Available:</strong>
                            ${step.beforeAvailable.map((b, i) => `R${i}: ${b}`).join(' | ')}
                        </div>
                        <div class="detail-row">
                            <strong>After Available:</strong>
                            ${step.afterAvailable.map((a, i) => `R${i}: ${a}`).join(' | ')}
                        </div>
                    </div>
                    <div class="step-description">
                        <i class="icon">ℹ️</i> ${step.description}
                    </div>
                </div>
            `;
            
            timeline.appendChild(stepElement);
        });
        
        stepsVisualization.appendChild(timeline);
    }

    // Reset functionality
    resetButton.addEventListener('click', () => {
        modeSelect.value = 'single';
        numProcessesInput.value = 3;
        numResourcesInput.value = 3;
        matricesDiv.classList.add('hidden');
        resultDiv.classList.add('hidden');
        stepsContainer.classList.add('hidden');
    });

    // Export scenario
    exportScenarioButton.addEventListener('click', () => {
        const { max, allocated, requested, available } = getMatrixValues();
        const scenario = { mode: modeSelect.value, max, allocated, requested, available };
        const scenarioJSON = JSON.stringify(scenario, null, 2);
        
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = scenarioJSON;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        
        alert('Scenario copied to clipboard!');
    });

    // Import scenario button
    importScenarioButton.addEventListener('click', () => {
        scenarioImportModal.classList.remove('hidden');
    });

    // Close modal
    closeModalButton.addEventListener('click', () => {
        scenarioImportModal.classList.add('hidden');
    });

    // Confirm import
    confirmImportButton.addEventListener('click', () => {
        try {
            const scenarioJSON = scenarioImportText.value;
            const scenario = JSON.parse(scenarioJSON);
            
            modeSelect.value = scenario.mode || 'single';
            numProcessesInput.value = scenario.allocated.length;
            numResourcesInput.value = scenario.allocated[0].length;
            
            createMatricesButton.click();
            
            scenario.allocated.forEach((processAllocated, i) => {
                processAllocated.forEach((val, j) => {
                    document.getElementById(`allocated-${i}-${j}`).value = val;
                });
            });
            
            if (scenario.mode === 'single' && scenario.requested) {
                scenario.requested.forEach((processRequested, i) => {
                    processRequested.forEach((val, j) => {
                        document.getElementById(`requested-${i}-${j}`).value = val;
                    });
                });
            } else if (scenario.mode === 'multi' && scenario.max) {
                scenario.max.forEach((processMax, i) => {
                    processMax.forEach((val, j) => {
                        document.getElementById(`max-${i}-${j}`).value = val;
                    });
                });
            }
            
            scenario.available.forEach((val, j) => {
                document.getElementById(`available-${j}`).value = val;
            });
            
            scenarioImportModal.classList.add('hidden');
        } catch (error) {
            alert('Invalid scenario JSON. Please check the format.');
        }
    });

    // Detect deadlock button
    detectDeadlockButton.addEventListener('click', () => {
        const result = detectDeadlock();
        displayResult(result);
        visualizeSteps(result);
        stepsContainer.classList.remove('hidden');
    });

    // Update visibility on mode change
    modeSelect.addEventListener('change', () => {
        if (!matricesDiv.classList.contains('hidden')) {
            createMatricesButton.click();
        }
    });
});