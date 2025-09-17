// VOICE-CMD Frontend Command Box
// Updated to show structured status messages for file operations

class CommandBox {
    constructor() {
        this.micButton = document.getElementById('micButton');
        this.recognizedCommand = document.getElementById('recognizedCommand');
        this.outputLog = document.getElementById('outputLog');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.commandInput = document.getElementById('commandInput');
        this.sendButton = document.getElementById('sendButton');
        this.themeToggle = document.getElementById('themeToggle');
        this.isListening = false;
        this.backendUrl = 'http://localhost:3000';
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        this.initializeEventListeners();
        this.initializeTheme();
        this.checkBackendConnection();
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

        // Theme toggle
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    /**
     * Send Text Command
     */
    async sendTextCommand() {
        const command = this.commandInput.value.trim();
        
        if (!command) {
            this.addLogEntry('error', 'Please enter a command.');
            return;
        }

        // Update recognized command display
        this.recognizedCommand.value = command;
        
        // Clear input and disable send button
        this.commandInput.value = '';
        this.sendButton.disabled = true;
        this.sendButton.textContent = 'Sending...';
        
        // Show loading indicator
        this.addLogEntry('loading', `Sending command: "${command}"`);
        this.updateUI('processing');
        
        this.sendCommandToBackend(command);
    }

    /**
     * Send Command to Backend
     */
    async sendCommandToBackend(command) {
        try {
            this.addLogEntry('info', 'Connecting to backend...');
            
            const response = await fetch(`${this.backendUrl}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ commandText: command })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            this.displayStructuredResponse(result);

        } catch (error) {
            console.error('Backend communication error:', error);
            
            if (error.message.includes('Failed to fetch')) {
                this.addLogEntry('error', '❌ Backend server is not running');
                this.addLogEntry('warning', 'Please start the backend server: cd backend && node server.js');
            } else {
                this.addLogEntry('error', `❌ Backend error: ${error.message}`);
            }
            
            this.updateUI('error');
        } finally {
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Send';
        }
    }

    /**
     * Display Structured Response with Enhanced UI
     */
    displayStructuredResponse(result) {
        // Display input with command context
        this.addLogEntry('info', `Input: "${result.input}"`, result.input);
        
        // Display action
        this.addLogEntry('info', `Action: ${result.action}`);
        
        // Display result with enhanced styling
        if (result.success) {
            this.addLogEntry('success', `Result: ${result.result}`);
            this.updateUI('ready');
        } else {
            // Check if it's a security block
            if (result.blocked) {
                this.addLogEntry('blocked', `SECURITY BLOCKED: ${result.result}`);
                this.updateUI('blocked');
            } else {
                this.addLogEntry('error', `Error: ${result.result}`);
                this.updateUI('error');
            }
        }
    }

    /**
     * Toggle Voice Capture
     */
    toggleVoiceCapture() {
        if (this.isListening) {
            this.stopVoiceCapture();
        } else {
            this.startVoiceCapture();
        }
    }

    /**
     * Start Voice Capture
     */
    startVoiceCapture() {
        this.isListening = true;
        this.micButton.classList.add('listening');
        this.micButton.querySelector('.mic-text').textContent = 'Listening...';
        this.updateUI('listening');
        this.addLogEntry('info', 'Voice capture started. Speak your command...');
        
        // Simulate voice recognition for now
        setTimeout(() => {
            this.simulateVoiceRecognition();
        }, 2000);
    }

    /**
     * Stop Voice Capture
     */
    stopVoiceCapture() {
        this.isListening = false;
        this.micButton.classList.remove('listening');
        this.micButton.querySelector('.mic-text').textContent = 'Click to Start Voice Input';
        this.updateUI('ready');
        this.addLogEntry('info', 'Voice capture stopped.');
    }

    /**
     * Simulate Voice Recognition
     */
    simulateVoiceRecognition() {
        const sampleCommands = [
            'create file hello.txt',
            'list files',
            'delete file test.txt',
            'copy file a.txt to b.txt',
            'move file old.txt to backup/'
        ];
        
        const randomCommand = sampleCommands[Math.floor(Math.random() * sampleCommands.length)];
        
        this.recognizedCommand.value = randomCommand;
        this.commandInput.value = randomCommand;
        
        this.addLogEntry('info', `Voice recognized: "${randomCommand}"`);
        this.stopVoiceCapture();
        
        // Auto-send the command
        setTimeout(() => {
            this.sendTextCommand();
        }, 500);
    }

    /**
     * Update UI Status
     */
    updateUI(status) {
        this.statusIndicator.textContent = status;
        this.statusIndicator.className = `status-indicator ${status}`;
    }

    /**
     * Add Log Entry with Enhanced Formatting
     */
    addLogEntry(type, message, command = null) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const date = new Date().toLocaleDateString();
        
        // Enhanced formatting based on type
        let icon = '';
        let formattedMessage = message;
        
        switch(type) {
            case 'success':
                icon = '✅';
                break;
            case 'error':
                icon = '❌';
                break;
            case 'blocked':
                icon = '🚫';
                break;
            case 'warning':
                icon = '⚠️';
                break;
            case 'info':
                icon = 'ℹ️';
                break;
            case 'loading':
                icon = '⏳';
                break;
            default:
                icon = '📝';
        }
        
        logEntry.innerHTML = `
            <div class="log-header">
                <span class="timestamp">[${date} ${timestamp}]</span>
                <span class="log-type">${type.toUpperCase()}</span>
            </div>
            <div class="log-content">
                <span class="log-icon">${icon}</span>
                <span class="message">${formattedMessage}</span>
            </div>
            ${command ? `<div class="log-command">Command: "${command}"</div>` : ''}
        `;
        
        this.outputLog.appendChild(logEntry);
        
        // Smooth auto-scroll to bottom
        this.outputLog.scrollTo({
            top: this.outputLog.scrollHeight,
            behavior: 'smooth'
        });
        
        // Add animation class
        logEntry.classList.add('log-entry-animate');
        setTimeout(() => {
            logEntry.classList.remove('log-entry-animate');
        }, 300);
    }

    /**
     * Check Backend Connection
     */
    async checkBackendConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/`);
            if (response.ok) {
                this.addLogEntry('success', 'Backend connected successfully');
                this.updateUI('ready');
            } else {
                throw new Error('Backend not responding');
            }
        } catch (error) {
            this.addLogEntry('error', 'Backend connection failed');
            this.addLogEntry('error', 'Make sure the backend server is running on port 3000');
            this.updateUI('error');
        }
    }

    /**
     * Initialize Theme
     */
    initializeTheme() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            this.themeToggle.querySelector('.theme-icon').textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            this.themeToggle.querySelector('.theme-icon').textContent = '🌙';
        }
    }

    /**
     * Toggle Theme
     */
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            this.themeToggle.querySelector('.theme-icon').textContent = '☀️';
            this.addLogEntry('info', 'Switched to dark mode');
        } else {
            document.body.classList.remove('dark-mode');
            this.themeToggle.querySelector('.theme-icon').textContent = '🌙';
            this.addLogEntry('info', 'Switched to light mode');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CommandBox();
});
