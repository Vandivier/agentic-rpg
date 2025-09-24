class GameClient {
    constructor() {
        this.socket = io();
        this.sessionId = null;
        this.currentScene = null;
        this.character = null;
        this.isProcessing = false;

        this.elements = {
            sessionId: document.getElementById('session-id'),
            turnCount: document.getElementById('turn-count'),
            sceneImg: document.getElementById('scene-img'),
            sceneTitle: document.getElementById('scene-title'),
            sceneTags: document.getElementById('scene-tags'),
            narrationText: document.getElementById('narration-text'),
            logEntries: document.getElementById('log-entries'),
            characterName: document.getElementById('character-name'),
            hpCurrent: document.getElementById('hp-current'),
            hpMax: document.getElementById('hp-max'),
            hpFill: document.getElementById('hp-fill'),
            goldAmount: document.getElementById('gold-amount'),
            inventoryItems: document.getElementById('inventory-items'),
            choiceChips: document.getElementById('choice-chips'),
            playerInput: document.getElementById('player-input'),
            submitButton: document.getElementById('submit-action'),
            inputStatus: document.getElementById('input-status'),
            imageLoading: document.getElementById('image-loading')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createSession();
        this.updateCharacterDisplay();
    }

    setupEventListeners() {
        this.elements.submitButton.addEventListener('click', () => this.submitAction());
        this.elements.playerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitAction();
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.setStatus('Connection lost. Reconnecting...', 'error');
        });

        this.socket.on('turn-complete', (data) => {
            this.handleTurnComplete(data);
        });

        this.socket.on('narration-stream', (data) => {
            this.handleNarrationStream(data);
        });

        this.socket.on('image-generating', (data) => {
            this.handleImageGenerating(data);
        });

        this.socket.on('image-ready', (data) => {
            this.handleImageReady(data);
        });

        this.socket.on('image-error', (data) => {
            this.handleImageError(data);
        });

        this.socket.on('error', (data) => {
            this.handleError(data);
        });
    }

    async createSession() {
        try {
            const response = await fetch('/api/session', { method: 'POST' });
            const data = await response.json();
            this.sessionId = data.sessionId;
            this.elements.sessionId.textContent = `Session: ${this.sessionId.slice(0, 8)}...`;

            this.character = {
                name: 'Adventurer',
                hp: { current: 25, max: 25 },
                abilities: { STR: 12, DEX: 14, CON: 13, INT: 11, WIS: 15, CHA: 10 },
                resources: { gold: 50 },
                inventory: ['Basic Equipment']
            };

            this.currentScene = {
                id: 'tavern_start',
                title: 'The Crossed Swords Tavern',
                tags: ['tavern', 'starting_location']
            };

            this.updateDisplay();

        } catch (error) {
            console.error('Failed to create session:', error);
            this.setStatus('Failed to connect. Please refresh the page.', 'error');
        }
    }

    submitAction() {
        if (this.isProcessing) return;

        const input = this.elements.playerInput.value.trim();
        if (!input && !this.selectedChoice) {
            this.setStatus('Please enter an action or select a choice.', 'error');
            return;
        }

        const action = this.selectedChoice || input;

        this.isProcessing = true;
        this.showProcessingMessage();
        this.elements.submitButton.disabled = true;
        this.elements.playerInput.disabled = true;

        this.socket.emit('player-action', {
            sessionId: this.sessionId,
            playerInput: action,
            sceneId: this.currentScene.id
        });

        this.addToActionLog(`You: ${action}`, 'player');
        this.elements.playerInput.value = '';
        this.clearChoiceSelection();
    }

    handleTurnComplete(data) {
        this.isProcessing = false;
        this.elements.submitButton.disabled = false;
        this.elements.playerInput.disabled = false;
        this.hideProcessingMessage();

        if (data.finalResponse) {
            this.updateFromResponse(data.finalResponse);
        }
    }

    showProcessingMessage() {
        this.setStatus('Result Processing', 'processing');
        this.startEllipsisAnimation();
    }

    hideProcessingMessage() {
        this.stopEllipsisAnimation();
        this.setStatus('');
    }

    startEllipsisAnimation() {
        let dots = 0;
        this.ellipsisInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            const ellipsis = '.'.repeat(dots);
            this.setStatus(`Result Processing${ellipsis}`, 'processing');
        }, 500);
    }

    stopEllipsisAnimation() {
        if (this.ellipsisInterval) {
            clearInterval(this.ellipsisInterval);
            this.ellipsisInterval = null;
        }
    }

    handleNarrationStream(data) {
        if (data.complete) {
            this.elements.narrationText.classList.remove('streaming');
            this.elements.narrationText.textContent = data.content;
        } else {
            this.elements.narrationText.classList.add('streaming');
            this.elements.narrationText.textContent = data.content;
        }
    }

    handleImageGenerating(data) {
        this.elements.imageLoading.style.display = 'flex';
    }

    handleImageReady(data) {
        this.elements.imageLoading.style.display = 'none';
        this.elements.sceneImg.src = data.url;
    }

    handleImageError(data) {
        this.elements.imageLoading.style.display = 'none';
        console.error('Image generation failed:', data);
    }

    handleError(data) {
        this.isProcessing = false;
        this.elements.submitButton.disabled = false;
        this.elements.playerInput.disabled = false;
        this.hideProcessingMessage();
        this.setStatus(data.message || 'An error occurred', 'error');
    }

    updateFromResponse(response) {
        if (response.narration) {
            this.elements.narrationText.textContent = response.narration;
        }

        if (response.choices) {
            this.updateChoices(response.choices);
        }

        if (response.actionLog) {
            response.actionLog.forEach(entry => {
                this.addToActionLog(this.formatLogEntry(entry), entry.type);
            });
        }

        if (response.turnCount) {
            this.elements.turnCount.textContent = `Turn: ${response.turnCount}`;
        }
    }

    updateChoices(choices) {
        this.elements.choiceChips.innerHTML = '';
        this.selectedChoice = null;

        choices.forEach((choice, index) => {
            const chip = document.createElement('div');
            chip.className = 'choice-chip';
            chip.textContent = choice;
            chip.dataset.choice = choice;

            chip.addEventListener('click', () => {
                this.selectChoice(chip, choice);
            });

            this.elements.choiceChips.appendChild(chip);
        });
    }

    selectChoice(chipElement, choice) {
        document.querySelectorAll('.choice-chip').forEach(chip => {
            chip.classList.remove('selected');
        });

        chipElement.classList.add('selected');
        this.selectedChoice = choice;
    }

    clearChoiceSelection() {
        document.querySelectorAll('.choice-chip').forEach(chip => {
            chip.classList.remove('selected');
        });
        this.selectedChoice = null;
    }

    addToActionLog(message, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;

        this.elements.logEntries.appendChild(entry);
        this.elements.logEntries.scrollTop = this.elements.logEntries.scrollHeight;

        if (this.elements.logEntries.children.length > 50) {
            this.elements.logEntries.removeChild(this.elements.logEntries.firstChild);
        }
    }

    formatLogEntry(entry) {
        switch (entry.type) {
            case 'check':
                const result = entry.result === 'success' ? 'Success' : 'Failure';
                return `${entry.ability} check: ${entry.roll} + ${entry.total - entry.roll} = ${entry.total} vs DC ${entry.dc} (${result})`;

            case 'combat':
                if (entry.hit) {
                    return `Attack hit for ${entry.damage?.total || 0} damage`;
                } else {
                    return `Attack missed (${entry.total} vs AC ${entry.targetAC})`;
                }

            case 'system':
                return entry.message;

            default:
                return JSON.stringify(entry);
        }
    }

    updateDisplay() {
        this.updateCharacterDisplay();
        this.updateSceneDisplay();
    }

    updateCharacterDisplay() {
        if (!this.character) return;

        this.elements.characterName.textContent = this.character.name;
        this.elements.hpCurrent.textContent = this.character.hp.current;
        this.elements.hpMax.textContent = this.character.hp.max;

        const hpPercent = (this.character.hp.current / this.character.hp.max) * 100;
        this.elements.hpFill.style.width = `${hpPercent}%`;

        if (hpPercent > 60) {
            this.elements.hpFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
        } else if (hpPercent > 25) {
            this.elements.hpFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
        } else {
            this.elements.hpFill.style.background = 'linear-gradient(90deg, #F44336, #E57373)';
        }

        this.elements.goldAmount.textContent = this.character.resources.gold;

        document.querySelectorAll('.ability').forEach(abilityEl => {
            const ability = abilityEl.dataset.ability;
            const score = this.character.abilities[ability];
            const modifier = Math.floor((score - 10) / 2);

            abilityEl.querySelector('.ability-score').textContent = score;
            abilityEl.querySelector('.ability-mod').textContent = modifier >= 0 ? `+${modifier}` : `${modifier}`;
        });

        this.elements.inventoryItems.innerHTML = '';
        this.character.inventory.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.textContent = item;
            this.elements.inventoryItems.appendChild(itemEl);
        });
    }

    updateSceneDisplay() {
        if (!this.currentScene) return;

        this.elements.sceneTitle.textContent = this.currentScene.title;

        this.elements.sceneTags.innerHTML = '';
        if (this.currentScene.tags) {
            this.currentScene.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'scene-tag';
                tagEl.textContent = tag;
                this.elements.sceneTags.appendChild(tagEl);
            });
        }
    }

    setStatus(message, type = '') {
        this.elements.inputStatus.textContent = message;
        this.elements.inputStatus.className = `input-status ${type}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});