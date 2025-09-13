// VOICE-CMD Frontend JavaScript
// Frontend-backend integration for voice-controlled Linux command system

class VoiceCommand {
    constructor() {
        this.micButton = document.getElementById('micButton');
        this.commandInput = document.getElementById('commandInput');
        this.sendButton = document.getElementById('sendButton');
        this.recognizedCommand = document.getElementById('recognizedCommand');
        this.outputLog = document.getElementById('outputLog');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.isListening = false;
        
        // Backend configuration
        this.backendUrl = 'http://localhost:3000';
        
        this.initializeEventListeners();
        this.setupPlaceholderCommands();
    }

    initializeEventListeners() {
        // Mic button click event
        this.micButton.addEventListener('click', () => {
            this.toggleVoiceCapture();
        });

        // Send button click event
        this.sendButton.addEventListener('click', () => {
            this.sendTextCommand();
        });

        // Enter key in input field
        this.commandInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.sendTextCommand();
            }
        });

        // Update text area as user types
        this.commandInput.addEventListener('input', (event) => {
            this.recognizedCommand.value = event.target.value;
            this.recognizedCommand.classList.add('updating');
            setTimeout(() => {
                this.recognizedCommand.classList.remove('updating');
            }, 300);
        });

        // Keyboard shortcut for voice capture (Space key)
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !event.target.matches('textarea, input')) {
                event.preventDefault();
                this.toggleVoiceCapture();
            }
        });
    }

    setupPlaceholderCommands() {
        // Sample commands for demonstration
        this.sampleCommands = [
            "list files",
            "create directory test",
            "create file hello.txt",
            "list processes",
            "delete file test.txt",
            "copy file source.txt destination.txt",
            "move file old.txt new.txt"
        ];
    }

    toggleVoiceCapture() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        this.isListening = true;
        this.updateUI('listening');
        this.addLogEntry('info', 'Listening for voice command...');
        
        // Simulate voice recognition delay
        setTimeout(() => {
            this.simulateVoiceRecognition();
        }, 1500);
    }

    stopListening() {
        this.isListening = false;
        this.updateUI('ready');
        this.addLogEntry('info', 'Voice capture stopped.');
    }

    simulateVoiceRecognition() {
        // Simulate voice recognition with random sample command
        const randomCommand = this.sampleCommands[Math.floor(Math.random() * this.sampleCommands.length)];
        
        this.recognizedCommand.value = randomCommand;
        this.addLogEntry('success', `Voice recognized: "${randomCommand}"`);
        
        // Send the command to backend
        this.sendCommandToBackend(randomCommand);
        
        this.stopListening();
    }

    sendTextCommand() {
        const command = this.commandInput.value.trim();
        
        if (!command) {
            this.addLogEntry('error', 'Please enter a command.');
            return;
        }

        // Update recognized command display BEFORE clearing input
        this.recognizedCommand.value = command;
        
        // Clear input and disable send button
        this.commandInput.value = '';
        this.sendButton.disabled = true;
        this.sendButton.textContent = 'Sending...';
        
        this.addLogEntry('info', `Sending command: "${command}"`);
        this.sendCommandToBackend(command);
    }

    async sendCommandToBackend(command) {
        try {
            this.updateUI('processing');
            this.addLogEntry('info', 'Sending command to backend...');
            console.log('Sending command to backend:', command);
            
            // Add visual feedback to text area
            this.recognizedCommand.classList.add('updating');

            const response = await fetch(`${this.backendUrl}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ commandText: command })
            });

            console.log('Backend response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Backend response:', result);
            this.displayBackendResponse(result);

        } catch (error) {
            console.error('Backend communication error:', error);
            this.addLogEntry('error', `Failed to communicate with backend: ${error.message}`);
            this.addLogEntry('error', 'Make sure the backend server is running on port 3000');
            this.updateUI('error');
        } finally {
            // Remove visual feedback and re-enable send button
            this.recognizedCommand.classList.remove('updating');
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Send';
        }
    }

    displayBackendResponse(result) {
        const timestamp = new Date().toLocaleTimeString();
        
        // Ensure the recognized command text area shows the command
        if (result.receivedCommand) {
            this.recognizedCommand.value = result.receivedCommand;
        }
        
        // Display received command
        this.addLogEntry('info', `[${timestamp}] Command: "${result.receivedCommand}"`);
        
        // Display mapped command
        if (result.mappedCommand) {
            this.addLogEntry('info', `Mapped to: ${result.mappedCommand}`);
        }

        // Display result based on status
        if (result.status === 'success') {
            this.addLogEntry('success', `Output: ${result.output}`);
            this.updateUI('ready');
        } else {
            this.addLogEntry('error', `Error: ${result.error || result.message}`);
            this.updateUI('error');
        }

        // Display any additional error information
        if (result.error && result.status === 'error') {
            this.addLogEntry('error', `Details: ${result.error}`);
        }
    }

    updateUI(state) {
        const statusText = this.statusIndicator.querySelector('.status-text');
        const statusDot = this.statusIndicator.querySelector('.status-dot');
        
        switch(state) {
            case 'listening':
                this.micButton.classList.add('listening');
                this.micButton.querySelector('.mic-text').textContent = 'Listening...';
                statusText.textContent = 'Listening';
                this.statusIndicator.classList.add('listening');
                break;
            case 'processing':
                this.micButton.classList.remove('listening');
                this.micButton.querySelector('.mic-text').textContent = 'Processing...';
                statusText.textContent = 'Processing';
                this.statusIndicator.classList.remove('listening', 'error');
                break;
            case 'ready':
                this.micButton.classList.remove('listening');
                this.micButton.querySelector('.mic-text').textContent = 'Click to Speak';
                statusText.textContent = 'Ready';
                this.statusIndicator.classList.remove('listening', 'error');
                break;
            case 'error':
                statusText.textContent = 'Error';
                this.statusIndicator.classList.add('error');
                break;
        }
    }

    addLogEntry(type, message) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;
        
        this.outputLog.appendChild(logEntry);
        this.outputLog.scrollTop = this.outputLog.scrollHeight;
    }

    // Test backend connection
    async testBackendConnection() {
        try {
            this.addLogEntry('info', 'Testing backend connection...');
            const response = await fetch(`${this.backendUrl}/`);
            const result = await response.json();
            
            if (result.status === 'Backend server running') {
                this.addLogEntry('success', 'Backend connection successful!');
                return true;
            } else {
                this.addLogEntry('error', 'Backend responded with unexpected status.');
                return false;
            }
        } catch (error) {
            this.addLogEntry('error', `Backend connection failed: ${error.message}`);
            return false;
        }
    }

    // TODO: Implement Web Speech API integration
    setupWebSpeechAPI() {
        // This will be implemented for real voice recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                const command = event.results[0][0].transcript;
                this.recognizedCommand.value = command;
                this.sendCommandToBackend(command);
            };
            
            this.recognition.onerror = (event) => {
                this.addLogEntry('error', `Speech recognition error: ${event.error}`);
                this.updateUI('error');
            };
        } else {
            this.addLogEntry('error', 'Speech recognition not supported in this browser.');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const voiceCommand = new VoiceCommand();
    
    // Add initial instructions
    voiceCommand.addLogEntry('info', 'Welcome to VOICE-CMD!');
    voiceCommand.addLogEntry('info', 'Type a command in the input box or click the mic button for voice input.');
    voiceCommand.addLogEntry('info', 'Example commands: "list files", "create directory test", "list processes"');
    
    // Test backend connection
    await voiceCommand.testBackendConnection();
});