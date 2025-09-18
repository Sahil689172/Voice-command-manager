// VOICE-CMD Frontend JavaScript
// Frontend-backend integration for voice-controlled Linux command system

// Setup Web Speech API (works in Chrome, Edge; not all browsers support it)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // change if needed
} else {
    console.warn("Web Speech API not supported in this browser");
}

class VoiceCommand {
    constructor() {
        this.micButton = document.getElementById('micButton');
        this.commandInput = document.getElementById('commandInput');
        this.sendButton = document.getElementById('sendButton');
        this.recognizedCommand = document.getElementById('recognizedCommand');
        this.outputLog = document.getElementById('outputLog');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.historyList = document.getElementById('historyList');
        this.historyStats = document.getElementById('historyStats');
        this.schedulerList = document.getElementById('schedulerList');
        this.schedulerStats = document.getElementById('schedulerStats');
        this.schedulerForm = document.getElementById('schedulerForm');
        this.authSection = document.getElementById('authSection');
        this.mainApp = document.getElementById('mainApp');
        this.currentUsername = document.getElementById('currentUsername');
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.connectionText = document.getElementById('connectionText');
        this.liveEventsList = document.getElementById('liveEventsList');
        this.isListening = false;
        this.isAuthenticated = false;
        this.authToken = null;
        this.ws = null;
        this.wsConnected = false;
        this.autoScroll = true;
        
        // Backend configuration
        this.backendUrl = 'http://localhost:3000';
        
        this.initializeEventListeners();
        this.setupPlaceholderCommands();
    }

    // Voice recognition function
    startVoiceRecognition() {
        if (!recognition) {
            alert("Voice recognition not supported in this browser");
            return;
        }

        recognition.start();

        recognition.onstart = () => {
            console.log("🎙️ Voice recognition started...");
            this.updateUI('listening');
            this.addLogEntry('info', '🎙️ Listening for voice command...');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            console.log("Heard:", transcript);
            
            // Check for empty or very short commands
            if (!transcript || transcript.length < 2) {
                this.addLogEntry('warning', '⚠️ I didn\'t catch that. Please repeat.');
                this.speakText("I didn't catch that. Please repeat.");
                this.updateUI('ready');
                return;
            }
            
            // Check for common noise/silence patterns
            const noisePatterns = ['um', 'uh', 'hmm', 'ah', 'oh', 'er', 'mm', 'huh'];
            if (noisePatterns.includes(transcript.toLowerCase())) {
                this.addLogEntry('warning', '⚠️ Please speak a clear command.');
                this.speakText("Please speak a clear command.");
                this.updateUI('ready');
                return;
            }
            
            // Update the recognized command display
            this.recognizedCommand.value = transcript;
            
            // Check for history-related voice commands
            if (this.handleHistoryVoiceCommand(transcript)) {
                return; // Command was handled as a history command
            }
            
            // Send transcript to backend
            this.sendCommandToBackend(transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            
            // Handle specific error types
            let errorMessage = "Voice recognition error";
            switch (event.error) {
                case 'no-speech':
                    errorMessage = "No speech detected. Please try again.";
                    this.speakText("No speech detected. Please try again.");
                    break;
                case 'audio-capture':
                    errorMessage = "Microphone not available. Please check your microphone.";
                    this.speakText("Microphone not available.");
                    break;
                case 'not-allowed':
                    errorMessage = "Microphone access denied. Please allow microphone access.";
                    this.speakText("Microphone access denied.");
                    break;
                case 'network':
                    errorMessage = "Network error. Please check your connection.";
                    this.speakText("Network error occurred.");
                    break;
                case 'aborted':
                    errorMessage = "Voice recognition was interrupted.";
                    break;
                default:
                    errorMessage = `Voice recognition error: ${event.error}`;
                    this.speakText("Voice recognition failed. Please try again.");
            }
            
            this.displayError(errorMessage);
            this.updateUI('error');
        };

        recognition.onend = () => {
            console.log("Voice recognition ended.");
            this.updateUI('ready');
        };
    }

    initializeEventListeners() {
        // Mic button click event
        this.micButton.addEventListener('click', () => {
            this.startVoiceRecognition();
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
                this.startVoiceRecognition();
            }
        });

        // History controls
        document.getElementById('refreshHistory').addEventListener('click', () => {
            this.loadCommandHistory();
        });

        document.getElementById('clearHistory').addEventListener('click', () => {
            this.clearCommandHistory();
        });

        // Scheduler controls
        document.getElementById('refreshSchedules').addEventListener('click', () => {
            this.loadSchedules();
        });

        document.getElementById('showSchedulerForm').addEventListener('click', () => {
            this.showSchedulerForm();
        });

        document.getElementById('createSchedule').addEventListener('click', () => {
            this.createSchedule();
        });

        document.getElementById('cancelScheduleForm').addEventListener('click', () => {
            this.hideSchedulerForm();
        });

        // Authentication controls
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('showRegisterForm').addEventListener('click', () => {
            this.showRegisterForm();
        });

        document.getElementById('showLoginForm').addEventListener('click', () => {
            this.showLoginForm();
        });

        document.getElementById('logoutButton').addEventListener('click', () => {
            this.handleLogout();
        });

        // Live Events controls
        document.getElementById('clearEvents').addEventListener('click', () => {
            this.clearLiveEvents();
        });

        document.getElementById('toggleEvents').addEventListener('click', () => {
            this.toggleAutoScroll();
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

    // Old voice capture methods removed - now using Web Speech API

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

            const response = await this.authenticatedFetch(`${this.backendUrl}/command`, {
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
            
            // Validate response structure
            if (!result || typeof result.status === 'undefined') {
                throw new Error('Invalid response format from backend');
            }
            
            this.displayBackendResponse(result);

        } catch (error) {
            console.error('Backend communication error:', error);
            
            // Handle different types of errors
            let errorMessage = "Failed to communicate with backend";
            let ttsMessage = "Backend communication failed";
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage = "Cannot connect to backend server";
                ttsMessage = "Cannot connect to server";
            } else if (error.message.includes('Invalid response format')) {
                errorMessage = "Backend returned invalid response";
                ttsMessage = "Invalid response from server";
            } else if (error.message.includes('HTTP error')) {
                errorMessage = `Server error: ${error.message}`;
                ttsMessage = "Server error occurred";
            }
            
            this.addLogEntry('error', `⚠️ ${errorMessage}: ${error.message}`);
            this.addLogEntry('error', 'Make sure the backend server is running on port 3000');
            this.speakText(ttsMessage);
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
        
        // Display received command
        this.addLogEntry('info', `[${timestamp}] Command: "${result.data.command}"`);
        
        // Handle the new unified response format with enhanced error handling
        if (result.status === "success") {
            // Show command result
            this.displayOutput(result.data.result || "No output");
            this.updateUI('ready');
            
            // TTS for successful commands
            this.speakText(`Command executed successfully`);
            
        } else if (result.status === "blocked") {
            this.displayError(`🚫 Command Blocked: ${result.message}`);
            this.updateUI('error');
            
            // TTS for blocked commands
            this.speakText(`Command blocked by security rules`);
            
        } else if (result.status === "error") {
            // Enhanced error display with error codes
            const errorIcon = this.getErrorIcon(result.code);
            const errorMessage = `${errorIcon} Error: ${result.message}`;
            this.displayError(errorMessage);
            this.updateUI('error');
            
            // TTS for errors
            this.speakText(`An error occurred: ${result.message}`);
            
        } else {
            // Fallback for malformed responses
            this.displayError(`⚠️ Unknown response format`);
            this.updateUI('error');
            this.speakText(`Something went wrong`);
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
    // Old setupWebSpeechAPI method removed - now using global recognition object
    // Helper functions for displaying output and errors
    displayOutput(msg) {
        this.addLogEntry('success', `Output: ${msg}`);
    }

    displayError(msg) {
        this.addLogEntry('error', msg);
    }

    // Get appropriate error icon based on error code
    getErrorIcon(errorCode) {
        const errorIcons = {
            'E_COMMAND_NOT_FOUND': '🔍',
            'E_PERMISSION_DENIED': '🔒',
            'E_COMMAND_TIMEOUT': '⏰',
            'E_FILE_NOT_FOUND': '📁',
            'E_SYNTAX_ERROR': '📝',
            'E_PARSE_ERROR': '🔧',
            'E_MEMORY_OPERATION_FAILED': '🧠',
            'E_FILE_OPERATION_FAILED': '📄',
            'E_SHELL_COMMAND_FAILED': '💻',
            'E_UNKNOWN_COMMAND': '❓',
            'E_SYSTEM_ERROR': '⚠️',
            'E_INTERNAL_ERROR': '💥',
            'E_MISSING_COMMAND': '📝',
            'E_EMPTY_COMMAND': '📝',
            'E_COMMAND_BLOCKED': '🚫',
            'E_COMMAND_FAILED': '❌'
        };
        return errorIcons[errorCode] || '⚠️';
    }

    // Safe TTS function with error handling
    speakText(text) {
        try {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.8;
                utterance.pitch = 1;
                utterance.volume = 0.7;
                
                utterance.onerror = (event) => {
                    console.warn('TTS Error:', event.error);
                    // Fallback to console log if TTS fails
                    console.log('TTS Fallback:', text);
                };
                
                speechSynthesis.speak(utterance);
        } else {
                console.log('TTS not supported, logging instead:', text);
            }
        } catch (error) {
            console.warn('TTS failed:', error.message);
            console.log('TTS Fallback:', text);
        }
    }

    // Command History Management Methods

    // Load command history from backend
    async loadCommandHistory() {
        try {
            this.addLogEntry('info', 'Loading command history...');
            
            const response = await this.authenticatedFetch(`${this.backendUrl}/history`);
            const result = await response.json();
            
            if (result.status === 'success') {
                this.displayCommandHistory(result.data.commands);
                this.updateHistoryStats(result.data.commands);
                this.addLogEntry('success', `Loaded ${result.data.commands.length} commands from history`);
            } else {
                this.addLogEntry('error', `Failed to load history: ${result.message}`);
            }
        } catch (error) {
            console.error('Error loading command history:', error);
            this.addLogEntry('error', `Failed to load command history: ${error.message}`);
        }
    }

    // Display command history in the UI
    displayCommandHistory(commands) {
        if (!commands || commands.length === 0) {
            this.historyList.innerHTML = `
                <div class="history-empty">
                    <p>No commands in history yet</p>
                    <p>Execute some commands to see them here</p>
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = commands.map(cmd => this.createHistoryItem(cmd)).join('');
    }

    // Create a history item element
    createHistoryItem(command) {
        const statusIcon = this.getStatusIcon(command.status);
        const timestamp = new Date(command.timestamp).toLocaleString();
        const resultPreview = command.result ? 
            (command.result.length > 100 ? command.result.substring(0, 100) + '...' : command.result) : 
            'No output';

        return `
            <div class="history-item" data-command-id="${command.id}">
                <div class="history-status ${command.status}">${statusIcon}</div>
                <div class="history-content">
                    <div class="history-command">${this.escapeHtml(command.command)}</div>
                    <div class="history-result">${this.escapeHtml(resultPreview)}</div>
                    <div class="history-timestamp">${timestamp}</div>
                </div>
                <div class="history-actions">
                    <button class="history-action replay" onclick="voiceCommand.reexecuteCommand('${command.id}')" title="Re-execute command">
                        <span>🔄</span> Replay
                    </button>
                    <button class="history-action copy" onclick="voiceCommand.copyCommand('${command.command}')" title="Copy command">
                        <span>📋</span> Copy
                    </button>
                </div>
            </div>
        `;
    }

    // Get status icon for command
    getStatusIcon(status) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'blocked': '⛔',
            'pending': '⏳'
        };
        return icons[status] || '❓';
    }

    // Update history statistics
    updateHistoryStats(commands) {
        const stats = {
            total: commands.length,
            success: commands.filter(cmd => cmd.status === 'success').length,
            error: commands.filter(cmd => cmd.status === 'error').length,
            blocked: commands.filter(cmd => cmd.status === 'blocked').length
        };

        document.getElementById('totalCommands').textContent = stats.total;
        document.getElementById('successCount').textContent = stats.success;
        document.getElementById('errorCount').textContent = stats.error;
        document.getElementById('blockedCount').textContent = stats.blocked;
    }

    // Re-execute a command from history
    async reexecuteCommand(commandId) {
        try {
            // Mark as re-executing
            const historyItem = document.querySelector(`[data-command-id="${commandId}"]`);
            if (historyItem) {
                historyItem.classList.add('reexecuting');
            }

            this.addLogEntry('info', 'Re-executing command from history...');
            this.speakText('Re-executing last command');

            const response = await fetch(`${this.backendUrl}/history/reexecute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: commandId })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.addLogEntry('success', `Re-executed: ${result.data.command}`);
                this.displayBackendResponse(result);
            } else {
                this.addLogEntry('error', `Re-execution failed: ${result.message}`);
                this.displayError(`Re-execution failed: ${result.message}`);
            }

            // Remove re-executing class
            if (historyItem) {
                historyItem.classList.remove('reexecuting');
            }

            // Refresh history to show the new execution
            await this.loadCommandHistory();

        } catch (error) {
            console.error('Error re-executing command:', error);
            this.addLogEntry('error', `Failed to re-execute command: ${error.message}`);
            
            // Remove re-executing class
            const historyItem = document.querySelector(`[data-command-id="${commandId}"]`);
            if (historyItem) {
                historyItem.classList.remove('reexecuting');
            }
        }
    }

    // Copy command to clipboard
    async copyCommand(command) {
        try {
            await navigator.clipboard.writeText(command);
            this.addLogEntry('success', 'Command copied to clipboard');
            this.speakText('Command copied to clipboard');
        } catch (error) {
            console.error('Error copying command:', error);
            this.addLogEntry('error', 'Failed to copy command to clipboard');
        }
    }

    // Clear command history
    async clearCommandHistory() {
        if (!confirm('Are you sure you want to clear all command history?')) {
            return;
        }

        try {
            this.addLogEntry('info', 'Clearing command history...');
            
            const response = await this.authenticatedFetch(`${this.backendUrl}/history/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.displayCommandHistory([]);
                this.updateHistoryStats([]);
                this.addLogEntry('success', 'Command history cleared');
                this.speakText('Command history cleared');
            } else {
                this.addLogEntry('error', `Failed to clear history: ${result.message}`);
            }
        } catch (error) {
            console.error('Error clearing command history:', error);
            this.addLogEntry('error', `Failed to clear command history: ${error.message}`);
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Handle history-related voice commands
    handleHistoryVoiceCommand(transcript) {
        const command = transcript.toLowerCase().trim();
        
        // History voice commands
        if (command.includes('repeat last command') || command.includes('replay last command')) {
            this.repeatLastCommand();
            return true;
        }
        
        if (command.includes('show my history') || command.includes('show history') || command.includes('display history')) {
            this.showHistory();
            return true;
        }
        
        if (command.includes('clear history') || command.includes('delete history')) {
            this.clearCommandHistory();
            return true;
        }
        
        if (command.includes('refresh history') || command.includes('reload history')) {
            this.loadCommandHistory();
            return true;
        }
        
        // Scheduler voice commands
        if (command.includes('schedule') && command.includes('at')) {
            this.handleScheduleVoiceCommand(command);
            return true;
        }
        
        if (command.includes('cancel') && (command.includes('schedule') || command.includes('job'))) {
            this.handleCancelScheduleVoiceCommand(command);
            return true;
        }
        
        if (command.includes('scheduled tasks') || command.includes('scheduled jobs') || command.includes('my schedules')) {
            this.showScheduledTasks();
            return true;
        }
        
        // Authentication voice commands
        if (command.includes('login') || command.includes('log in')) {
            this.handleAuthVoiceCommand(command);
            return true;
        }
        
        if (command.includes('logout') || command.includes('log out')) {
            this.handleLogout();
            return true;
        }
        
        if (command.includes('register') || command.includes('sign up')) {
            this.handleAuthVoiceCommand(command);
            return true;
        }
        
        return false; // Not a history command
    }

    // Repeat the last command from history
    async repeatLastCommand() {
        try {
            this.addLogEntry('info', 'Repeating last command...');
            this.speakText('Repeating last command');
            
            const response = await fetch(`${this.backendUrl}/history?limit=1`);
            const result = await response.json();
            
            if (result.status === 'success' && result.data.commands.length > 0) {
                const lastCommand = result.data.commands[0];
                await this.reexecuteCommand(lastCommand.id);
            } else {
                this.addLogEntry('warning', 'No commands in history to repeat');
                this.speakText('No commands in history to repeat');
            }
        } catch (error) {
            console.error('Error repeating last command:', error);
            this.addLogEntry('error', `Failed to repeat last command: ${error.message}`);
        }
    }

    // Show history (refresh and speak about it)
    async showHistory() {
        try {
            this.addLogEntry('info', 'Showing command history...');
            
            await this.loadCommandHistory();
            
            // Get history stats for TTS
            const response = await fetch(`${this.backendUrl}/history/stats`);
            const result = await response.json();
            
            if (result.status === 'success') {
                const stats = result.data;
            this.speakText(`You have ${stats.totalCommands} commands in history. ${stats.successCount} successful, ${stats.errorCount} errors, and ${stats.blockedCount} blocked.`);
        } else {
            this.speakText('Command history loaded');
        }
    } catch (error) {
        console.error('Error showing history:', error);
        this.addLogEntry('error', `Failed to show history: ${error.message}`);
    }
}

// Command Scheduler Management Methods

// Load schedules from backend
async loadSchedules() {
    try {
        this.addLogEntry('info', 'Loading scheduled commands...');
        
        const response = await this.authenticatedFetch(`${this.backendUrl}/schedule`);
        const result = await response.json();
        
        if (result.status === 'success') {
            this.displaySchedules(result.data.schedules);
            this.updateSchedulerStats(result.data);
            this.addLogEntry('success', `Loaded ${result.data.schedules.length} scheduled commands`);
        } else {
            this.addLogEntry('error', `Failed to load schedules: ${result.message}`);
        }
    } catch (error) {
        console.error('Error loading schedules:', error);
        this.addLogEntry('error', `Failed to load schedules: ${error.message}`);
    }
}

// Display schedules in the UI
displaySchedules(schedules) {
    if (!schedules || schedules.length === 0) {
        this.schedulerList.innerHTML = `
            <div class="scheduler-empty">
                <p>No scheduled commands yet</p>
                <p>Click "Schedule" to create your first automated command</p>
            </div>
        `;
        return;
    }

    this.schedulerList.innerHTML = schedules.map(schedule => this.createScheduleItem(schedule)).join('');
}

// Create a schedule item element
createScheduleItem(schedule) {
    const statusIcon = this.getScheduleStatusIcon(schedule.status);
    const scheduledTime = new Date(schedule.nextExecution).toLocaleString();
    const repeatText = schedule.repeat === 'once' ? 'One-time' : 
                      schedule.repeat === 'daily' ? 'Daily' :
                      schedule.repeat === 'weekly' ? 'Weekly' :
                      schedule.repeat === 'hourly' ? 'Hourly' : schedule.repeat;

    return `
        <div class="schedule-item" data-schedule-id="${schedule.id}">
            <div class="schedule-status ${schedule.status}">${statusIcon}</div>
            <div class="schedule-content">
                <div class="schedule-command">${this.escapeHtml(schedule.command)}</div>
                <div class="schedule-time">Scheduled: ${scheduledTime}</div>
                <div class="schedule-repeat">Repeat: ${repeatText}</div>
                ${schedule.description ? `<div class="schedule-description">${this.escapeHtml(schedule.description)}</div>` : ''}
            </div>
            <div class="schedule-actions">
                ${schedule.status === 'active' ? `
                    <button class="schedule-action cancel" onclick="voiceCommand.cancelSchedule('${schedule.id}')" title="Cancel schedule">
                        <span>❌</span> Cancel
                    </button>
                ` : ''}
                <button class="schedule-action view" onclick="voiceCommand.viewScheduleDetails('${schedule.id}')" title="View details">
                    <span>👁️</span> View
                </button>
            </div>
        </div>
    `;
}

// Get status icon for schedule
getScheduleStatusIcon(status) {
    const icons = {
        'active': '⏰',
        'completed': '✅',
        'cancelled': '❌',
        'overdue': '⚠️'
    };
    return icons[status] || '❓';
}

// Update scheduler statistics
updateSchedulerStats(data) {
    document.getElementById('totalSchedules').textContent = data.total;
    document.getElementById('activeSchedules').textContent = data.active;
    document.getElementById('completedSchedules').textContent = data.completed;
    document.getElementById('cancelledSchedules').textContent = data.cancelled;
}

// Show scheduler form
showSchedulerForm() {
    this.schedulerForm.style.display = 'block';
    
    // Set default time to 1 hour from now
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const timeString = now.toISOString().slice(0, 16);
    document.getElementById('scheduleTime').value = timeString;
    
    // Focus on command input
    document.getElementById('scheduleCommand').focus();
}

// Hide scheduler form
hideSchedulerForm() {
    this.schedulerForm.style.display = 'none';
    this.clearSchedulerForm();
}

// Clear scheduler form
clearSchedulerForm() {
    document.getElementById('scheduleCommand').value = '';
    document.getElementById('scheduleTime').value = '';
    document.getElementById('scheduleRepeat').value = 'once';
    document.getElementById('scheduleDescription').value = '';
}

// Create a new schedule
async createSchedule() {
    try {
        const command = document.getElementById('scheduleCommand').value.trim();
        const time = document.getElementById('scheduleTime').value;
        const repeat = document.getElementById('scheduleRepeat').value;
        const description = document.getElementById('scheduleDescription').value.trim();
        
        if (!command) {
            this.addLogEntry('error', 'Please enter a command to schedule');
            this.speakText('Please enter a command to schedule');
            return;
        }
        
        if (!time) {
            this.addLogEntry('error', 'Please select a time for the schedule');
            this.speakText('Please select a time for the schedule');
            return;
        }
        
        this.addLogEntry('info', 'Creating scheduled command...');
        
        const response = await this.authenticatedFetch(`${this.backendUrl}/schedule`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command,
                time,
                repeat,
                description
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            this.addLogEntry('success', `Scheduled: ${command} for ${new Date(time).toLocaleString()}`);
            this.speakText(`Command scheduled for ${new Date(time).toLocaleString()}`);
            this.hideSchedulerForm();
            await this.loadSchedules();
        } else {
            this.addLogEntry('error', `Failed to create schedule: ${result.message}`);
            this.speakText(`Failed to create schedule: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Error creating schedule:', error);
        this.addLogEntry('error', `Failed to create schedule: ${error.message}`);
        this.speakText('Failed to create schedule');
    }
}

// Cancel a schedule
async cancelSchedule(scheduleId) {
    try {
        this.addLogEntry('info', 'Cancelling scheduled command...');
        
        const response = await fetch(`${this.backendUrl}/schedule/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: scheduleId })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            this.addLogEntry('success', 'Schedule cancelled successfully');
            this.speakText('Schedule cancelled successfully');
            await this.loadSchedules();
        } else {
            this.addLogEntry('error', `Failed to cancel schedule: ${result.message}`);
            this.speakText(`Failed to cancel schedule: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Error cancelling schedule:', error);
        this.addLogEntry('error', `Failed to cancel schedule: ${error.message}`);
        this.speakText('Failed to cancel schedule');
    }
}

// View schedule details
viewScheduleDetails(scheduleId) {
    // This could open a modal or show more details
    this.addLogEntry('info', `Viewing details for schedule ${scheduleId}`);
    this.speakText('Schedule details viewed');
}

// Handle schedule voice commands
handleScheduleVoiceCommand(command) {
    // Parse voice command for scheduling
    // Examples: "schedule 'list files' at 5 PM", "run 'check memory' every day at 9 AM"
    
    this.addLogEntry('info', 'Processing schedule voice command...');
    this.speakText('I can help you schedule commands. Please use the form to specify the exact command and time.');
    
    // Show the scheduler form
    this.showSchedulerForm();
}

// Handle cancel schedule voice commands
async handleCancelScheduleVoiceCommand(command) {
    try {
        this.addLogEntry('info', 'Processing cancel schedule voice command...');
        
        // Load current schedules to show options
        await this.loadSchedules();
        
        // For now, just show the schedules and let user cancel via UI
        this.speakText('Here are your scheduled tasks. You can cancel them using the cancel buttons.');
        
    } catch (error) {
        console.error('Error handling cancel schedule command:', error);
        this.addLogEntry('error', `Failed to process cancel schedule command: ${error.message}`);
    }
}

// Show scheduled tasks
async showScheduledTasks() {
    try {
        this.addLogEntry('info', 'Showing scheduled tasks...');
        
        await this.loadSchedules();
        
        // Get schedule stats for TTS
        const response = await fetch(`${this.backendUrl}/schedule/stats`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const stats = result.data;
            this.speakText(`You have ${stats.total} scheduled tasks. ${stats.active} active, ${stats.completed} completed, and ${stats.cancelled} cancelled.`);
        } else {
            this.speakText('Scheduled tasks loaded');
        }
        
    } catch (error) {
        console.error('Error showing scheduled tasks:', error);
        this.addLogEntry('error', `Failed to show scheduled tasks: ${error.message}`);
    }
}

// Handle authentication voice commands
handleAuthVoiceCommand(command) {
    this.addLogEntry('info', 'Processing authentication voice command...');
    
    if (command.includes('login') || command.includes('log in')) {
        this.speakText('Please use the login form to enter your credentials.');
        this.showLoginForm();
    } else if (command.includes('register') || command.includes('sign up')) {
        this.speakText('Please use the registration form to create your account.');
        this.showRegisterForm();
    } else {
        this.speakText('I can help you with login or registration. Please use the forms provided.');
    }
}

// Authentication Management Methods

// Check if user is authenticated on startup
async checkAuthentication() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.showAuthSection();
            return false;
        }

        const response = await fetch(`${this.backendUrl}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            this.isAuthenticated = true;
            this.authToken = token;
            this.currentUsername.textContent = result.data.user.username;
            this.showMainApp();
            this.addLogEntry('success', `Welcome back, ${result.data.user.username}!`);
            
            // Connect to WebSocket
            this.connectWebSocket();
            
            return true;
        } else {
            localStorage.removeItem('authToken');
            this.showAuthSection();
            return false;
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('authToken');
        this.showAuthSection();
        return false;
    }
}

// Handle user login
async handleLogin() {
    try {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.addLogEntry('error', 'Please enter both username and password');
            return;
        }

        this.addLogEntry('info', 'Logging in...');

        const response = await fetch(`${this.backendUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.status === 'success') {
            this.isAuthenticated = true;
            this.authToken = result.data.token;
            this.currentUsername.textContent = result.data.user.username;
            
            // Store token in localStorage
            localStorage.setItem('authToken', result.data.token);
            
            this.showMainApp();
            this.addLogEntry('success', `Welcome back, ${result.data.user.username}!`);
            this.speakText(`Welcome back, ${result.data.user.username}!`);
            
            // Connect to WebSocket
            this.connectWebSocket();
            
            // Load user-specific data
            await this.loadCommandHistory();
            await this.loadSchedules();
        } else {
            this.addLogEntry('error', `Login failed: ${result.message}`);
            this.speakText('Login failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        this.addLogEntry('error', `Login failed: ${error.message}`);
        this.speakText('Login failed. Please try again.');
    }
}

// Handle user registration
async handleRegister() {
    try {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !password || !confirmPassword) {
            this.addLogEntry('error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.addLogEntry('error', 'Passwords do not match');
            return;
        }

        this.addLogEntry('info', 'Creating account...');

        const response = await fetch(`${this.backendUrl}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.status === 'success') {
            this.addLogEntry('success', `Account created successfully! Please login.`);
            this.speakText('Account created successfully! Please login.');
            this.showLoginForm();
        } else {
            this.addLogEntry('error', `Registration failed: ${result.message}`);
            this.speakText(`Registration failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Error during registration:', error);
        this.addLogEntry('error', `Registration failed: ${error.message}`);
        this.speakText('Registration failed. Please try again.');
    }
}

// Handle user logout
async handleLogout() {
    try {
        if (this.authToken) {
            // Call logout endpoint
            await fetch(`${this.backendUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
        }

        // Disconnect WebSocket
        this.disconnectWebSocket();
        
        // Clear local state
        this.isAuthenticated = false;
        this.authToken = null;
        localStorage.removeItem('authToken');
        
        // Clear UI
        this.showAuthSection();
        this.clearAllData();
        
        this.addLogEntry('info', 'Logged out successfully');
        this.speakText('You are now logged out.');
    } catch (error) {
        console.error('Error during logout:', error);
        // Still clear local state even if server call fails
        this.isAuthenticated = false;
        this.authToken = null;
        localStorage.removeItem('authToken');
        this.showAuthSection();
        this.clearAllData();
    }
}

// Show authentication section
showAuthSection() {
    this.authSection.style.display = 'block';
    this.mainApp.style.display = 'none';
}

// Show main application
showMainApp() {
    this.authSection.style.display = 'none';
    this.mainApp.style.display = 'block';
}

// Show login form
showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

// Show register form
showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Clear all user data from UI
clearAllData() {
    this.historyList.innerHTML = `
        <div class="history-empty">
            <p>No commands in history yet</p>
            <p>Execute some commands to see them here</p>
        </div>
    `;
    
    this.schedulerList.innerHTML = `
        <div class="scheduler-empty">
            <p>No scheduled commands yet</p>
            <p>Click "Schedule" to create your first automated command</p>
        </div>
    `;
    
    this.updateHistoryStats({ total: 0, success: 0, error: 0, blocked: 0 });
    this.updateSchedulerStats({ total: 0, active: 0, completed: 0, cancelled: 0 });
}

// Override fetch to include auth token
async authenticatedFetch(url, options = {}) {
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json'
    };
    
    if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return fetch(url, {
        ...options,
        headers
    });
}

// WebSocket Management Methods

// Connect to WebSocket server
connectWebSocket() {
    try {
        const wsUrl = this.backendUrl.replace('http', 'ws') + '/ws';
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.wsConnected = true;
            this.updateConnectionStatus(true);
            this.addLiveEvent('system', 'WebSocket connected', 'Connected to real-time updates');
            
            // Authenticate with JWT token
            if (this.authToken) {
                this.ws.send(JSON.stringify({
                    type: 'authenticate',
                    token: this.authToken
                }));
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.wsConnected = false;
            this.updateConnectionStatus(false);
            this.addLiveEvent('system', 'WebSocket disconnected', 'Lost connection to real-time updates');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (this.isAuthenticated) {
                    this.connectWebSocket();
                }
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addLiveEvent('error', 'WebSocket error', 'Connection error occurred');
        };
        
    } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        this.addLiveEvent('error', 'WebSocket connection failed', error.message);
    }
}

// Handle WebSocket messages
handleWebSocketMessage(data) {
    switch (data.type) {
        case 'connection':
            this.addLiveEvent('system', 'Connected', data.message);
            break;
            
        case 'authenticated':
            this.addLiveEvent('system', 'Authenticated', `Logged in as ${data.userId}`);
            break;
            
        case 'commandExecuted':
            this.handleCommandExecutedEvent(data.data);
            break;
            
        case 'securityEvent':
            this.handleSecurityEvent(data.data);
            break;
            
        case 'memoryUpdated':
            this.handleMemoryUpdatedEvent(data.data);
            break;
            
        case 'scheduleTriggered':
            this.handleScheduleTriggeredEvent(data.data);
            break;
            
        case 'logEvent':
            this.handleLogEvent(data.data);
            break;
            
        case 'historyUpdated':
            this.handleHistoryUpdatedEvent(data.data);
            break;
            
        case 'systemStatus':
            this.handleSystemStatusEvent(data.data);
            break;
            
        case 'pong':
            // Handle pong response
            break;
            
        case 'error':
            this.addLiveEvent('error', 'WebSocket Error', data.message);
            break;
            
        default:
            console.log('Unknown WebSocket message type:', data.type);
    }
}

// Handle command executed event
handleCommandExecutedEvent(data) {
    this.addLiveEvent('commandExecuted', `Command: ${data.command}`, 
        `Status: ${data.status} | Result: ${data.result.substring(0, 100)}${data.result.length > 100 ? '...' : ''}`);
    
    // Update command history in real-time
    this.loadCommandHistory();
    
    // Speak result if TTS is enabled
    if (data.status === 'success' && data.result) {
        this.speakText(data.result);
    }
}

// Handle security event
handleSecurityEvent(data) {
    this.addLiveEvent('securityEvent', `Security: ${data.action}`, data.detail);
    
    // Speak security alert
    this.speakText(`Security alert: ${data.action}`);
}

// Handle memory updated event
handleMemoryUpdatedEvent(data) {
    this.addLiveEvent('memoryUpdated', `Memory: ${data.key}`, data.value);
}

// Handle schedule triggered event
handleScheduleTriggeredEvent(data) {
    this.addLiveEvent('scheduleTriggered', `Scheduled: ${data.command}`, 
        `Result: ${data.result.substring(0, 100)}${data.result.length > 100 ? '...' : ''}`);
    
    // Update schedules in real-time
    this.loadSchedules();
    
    // Speak schedule result
    this.speakText(`Scheduled command executed: ${data.result}`);
}

// Handle log event
handleLogEvent(data) {
    this.addLiveEvent('logEvent', data.level.toUpperCase(), data.message);
}

// Handle history updated event
handleHistoryUpdatedEvent(data) {
    this.addLiveEvent('historyUpdated', `History: ${data.action}`, 
        data.command ? `Command: ${data.command.command}` : 'History cleared');
    
    // Update history in real-time
    this.loadCommandHistory();
}

// Handle system status event
handleSystemStatusEvent(data) {
    this.addLiveEvent('system', `System: ${data.status}`, data.message);
}

// Update connection status UI
updateConnectionStatus(connected) {
    if (connected) {
        this.connectionIndicator.textContent = '🟢';
        this.connectionIndicator.className = 'connection-dot connected';
        this.connectionText.textContent = 'Connected';
    } else {
        this.connectionIndicator.textContent = '🔴';
        this.connectionIndicator.className = 'connection-dot disconnected';
        this.connectionText.textContent = 'Disconnected';
    }
}

// Add live event to the UI
addLiveEvent(type, title, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const eventElement = document.createElement('div');
    eventElement.className = 'live-event';
    
    eventElement.innerHTML = `
        <div class="live-event-timestamp">${timestamp}</div>
        <div class="live-event-type ${type}">${title}</div>
        <div class="live-event-message">${this.escapeHtml(message)}</div>
        ${data ? `<div class="live-event-data">${JSON.stringify(data)}</div>` : ''}
    `;
    
    // Remove empty state if it exists
    const emptyState = this.liveEventsList.querySelector('.live-events-empty');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Add event to the top
    this.liveEventsList.insertBefore(eventElement, this.liveEventsList.firstChild);
    
    // Keep only last 50 events
    const events = this.liveEventsList.querySelectorAll('.live-event');
    if (events.length > 50) {
        events[events.length - 1].remove();
    }
    
    // Auto-scroll to top if enabled
    if (this.autoScroll) {
        this.liveEventsList.scrollTop = 0;
    }
}

// Clear live events
clearLiveEvents() {
    this.liveEventsList.innerHTML = `
        <div class="live-events-empty">
            <p>No live events yet</p>
            <p>Execute commands to see real-time updates</p>
        </div>
    `;
}

// Toggle auto-scroll
toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    const icon = document.getElementById('autoScrollIcon');
    icon.textContent = this.autoScroll ? '📌' : '📌';
    icon.style.opacity = this.autoScroll ? '1' : '0.5';
}

// Disconnect WebSocket
disconnectWebSocket() {
    if (this.ws) {
        this.ws.close();
        this.ws = null;
        this.wsConnected = false;
        this.updateConnectionStatus(false);
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
    
    // Check voice recognition support
    if (recognition) {
        voiceCommand.addLogEntry('success', '🎤 Voice recognition is supported! Click the mic button to speak.');
    } else {
        voiceCommand.addLogEntry('error', '❌ Voice recognition not supported in this browser. Use text input instead.');
    }
    
    // Test backend connection
    await voiceCommand.testBackendConnection();
    
    // Check authentication first
    const isAuthenticated = await voiceCommand.checkAuthentication();
    
    if (isAuthenticated) {
        // Load user-specific data
        await voiceCommand.loadCommandHistory();
        await voiceCommand.loadSchedules();
    }
});