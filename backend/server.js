// VOICE-CMD Backend Server
// Basic server skeleton for voice-controlled Linux process & file manager

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const commandUtils = require('./commandUtils');
const tts = require('./tts'); // Added for Step 7 - TTS support

// Initialize Express app
const app = express();
const PORT = 3000;

// Configuration flags
const CONFIG = {
    TTS_ENABLED: true, // Set to true to enable TTS (optional feature)
    LOG_COMMANDS: true  // Set to true to enable command logging
};

// VOICE-CMD working directory
const WORKING_DIR = path.join(os.homedir(), 'Desktop', 'VOICE-CMD');

// Middleware setup
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON requests

// Basic route to check if server is running
app.get('/', (req, res) => {
    res.json({
        status: "Backend server running"
    });
});

// Voice command processing endpoint
// This handles voice commands from the frontend
app.post('/command', async (req, res) => {
    try {
        const { commandText } = req.body;
        
        // Validate that commandText exists
        if (!commandText) {
            return res.status(400).json({
                status: "error",
                receivedCommand: null,
                mappedCommand: null,
                output: null,
                error: "Missing commandText in request body",
                message: "Missing commandText in request body"
            });
        }
        
        // TODO: Add input validation and sanitization here
        // TODO: Add authentication/authorization checks here
        
        // Map the command to Linux shell command
        const mappedCommand = commandUtils.mapCommandToShell(commandText);
        
        // Execute the mapped command
        const executionResult = await commandUtils.executeCommand(mappedCommand);
        
        // TODO: Add result processing and error handling here
        
        // Log command execution (if enabled)
        if (CONFIG.LOG_COMMANDS) {
            commandUtils.logCommand(
                commandText,
                mappedCommand,
                executionResult.output,
                executionResult.error
            );
        }
        
        // Text-to-Speech (if enabled)
        if (CONFIG.TTS_ENABLED) {
            const textToSpeak = executionResult.success ? 
                executionResult.output : 
                executionResult.error || executionResult.output;
            
            // TTS is non-blocking - don't wait for it
            tts.speakText(textToSpeak).catch(ttsError => {
                console.log('TTS: Error speaking text:', ttsError.message);
            });
        }
        
        // Return JSON response for frontend consumption
        // Frontend will display this response in the log/output area
        if (executionResult.success) {
            res.json({
                status: "success",
                receivedCommand: commandText,
                mappedCommand: mappedCommand,
                output: executionResult.output,
                error: null,
                message: "Command executed successfully"
            });
        } else {
            res.status(400).json({
                status: "error",
                receivedCommand: commandText,
                mappedCommand: mappedCommand,
                output: executionResult.output,
                error: executionResult.error,
                message: "Command execution failed"
            });
        }
        
    } catch (error) {
        console.error('Error processing command:', error);
        // Return consistent JSON structure for frontend consumption
        res.status(500).json({
            status: "error",
            receivedCommand: commandText || "unknown",
            mappedCommand: null,
            output: null,
            error: error.message,
            message: "Internal server error processing command"
        });
    }
});

// TODO: Add command execution endpoints
// These will handle specific Linux commands
// Example: POST /api/execute-command

// TODO: Add file management endpoints
// These will handle file operations (create, delete, move, copy)
// Example: POST /api/file/create

// TODO: Add process management endpoints
// These will handle process operations (list, kill)
// Example: GET /api/processes

// Ensure VOICE-CMD working directory exists
function ensureWorkingDirectory() {
    try {
        if (!fs.existsSync(WORKING_DIR)) {
            fs.mkdirSync(WORKING_DIR, { recursive: true });
            console.log(`Created VOICE-CMD working directory: ${WORKING_DIR}`);
        } else {
            console.log(`VOICE-CMD working directory already exists: ${WORKING_DIR}`);
        }
        console.log(`VOICE-CMD working directory set to ~/Desktop/VOICE-CMD`);
    } catch (error) {
        console.error(`Error creating working directory: ${error.message}`);
        process.exit(1);
    }
}

// Check TTS availability on startup
async function checkTTSOnStartup() {
    if (CONFIG.TTS_ENABLED) {
        const ttsAvailable = await tts.checkTTSAvailability();
        if (ttsAvailable) {
            console.log('TTS: Text-to-Speech is available and enabled');
        } else {
            console.log('TTS: No TTS engine found - TTS will be disabled');
            CONFIG.TTS_ENABLED = false;
        }
    } else {
        console.log('TTS: Text-to-Speech is disabled');
    }
}

// Configuration endpoint
app.get('/config', (req, res) => {
    res.json({
        ttsEnabled: CONFIG.TTS_ENABLED,
        logCommands: CONFIG.LOG_COMMANDS,
        serverStatus: "running"
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Command logging: ${CONFIG.LOG_COMMANDS ? 'enabled' : 'disabled'}`);
    
    // Ensure working directory exists
    ensureWorkingDirectory();
    
    await checkTTSOnStartup();
});

module.exports = app;
