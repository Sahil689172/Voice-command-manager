// VOICE-CMD Backend Server
// Basic server skeleton for voice-controlled Linux process & file manager

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { exec } = require('child_process');
const commandUtils = require('./utils/commandUtils');
const tts = require('./tts'); // Added for Step 7 - TTS support
const memory = require('./memory'); // Added for Step 11 - Memory support
const security = require('./utils/security'); // Added for Step 12 - Security support
const logger = require('./utils/logger'); // Enhanced logging system

// Initialize Express app
const app = express();
const PORT = 3000;

// Configuration flags
const CONFIG = {
    TTS_ENABLED: true, // Set to true to enable TTS (optional feature)
    LOG_COMMANDS: true, // Set to true to enable command logging
    MEMORY_ENABLED: true, // Set to true to enable persistent memory
    SECURITY_ENABLED: true // Set to true to enable security sandboxing
};

// VOICE-CMD working directory
const WORKING_DIR = path.join(os.homedir(), 'Desktop', 'VOICE-CMD');

// Middleware setup
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON requests

// Basic route to check if server is running
app.get('/', (req, res) => {
    res.json({
        status: "Backend server running",
        workingDir: WORKING_DIR,
        features: ["File Operations", "Shell Commands", "TTS Support", "Speech-to-Text", "Persistent Memory", "Security Sandboxing"]
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
                input: "",
                action: "Validation Error",
                result: "Missing commandText in request body",
                success: false
            });
        }
        
        // Execute the command using the new command utils
        const result = await commandUtils.executeCommand(commandText);
        
        // Enhanced logging
        if (CONFIG.LOG_COMMANDS) {
            const logStatus = result.success ? 'SUCCESS' : (result.blocked ? 'BLOCKED' : 'ERROR');
            await logger.logCommand(
                commandText,
                logStatus,
                result.result,
                {
                    action: result.action,
                    success: result.success,
                    blocked: result.blocked || false,
                    timestamp: new Date().toISOString()
                }
            );
        }
        
        // Text-to-Speech (if enabled)
        if (CONFIG.TTS_ENABLED && result.success) {
            tts.speakText(result.result).catch(ttsError => {
                console.log('TTS: Error speaking text:', ttsError.message);
            });
        }
        
        // Return structured JSON response
        res.json(result);
        
    } catch (error) {
        console.error('Error processing command:', error);
        res.status(500).json({
            input: req.body.commandText || "unknown",
            action: "Internal Server Error",
            result: `Internal server error: ${error.message}`,
            success: false
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
        memoryEnabled: CONFIG.MEMORY_ENABLED,
        securityEnabled: CONFIG.SECURITY_ENABLED,
        serverStatus: "running"
    });
});

// Security stats endpoint
app.get('/security/stats', (req, res) => {
    try {
        const stats = security.getSecurityStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Security allowed commands endpoint
app.get('/security/commands', (req, res) => {
    try {
        res.json({
            success: true,
            allowedCommands: security.getAllowedCommands(),
            blockedCommands: security.getBlockedCommands()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Log statistics endpoint
app.get('/logs/stats', async (req, res) => {
    try {
        const stats = await logger.getLogStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear logs endpoint
app.post('/logs/clear', async (req, res) => {
    try {
        const result = await logger.clearLogs();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Speech-to-text transcription endpoint
app.post('/api/transcribe', upload.single('audio'), (req, res) => {
    const audioPath = path.resolve(req.file.path);
    const whisperBin = path.resolve('../../whisper.cpp/build/bin/whisper-cli');
    const modelPath = path.resolve('../../whisper.cpp/models/ggml-base.en.bin');

    const cmd = `${whisperBin} -m ${modelPath} -f ${audioPath}`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Transcription error: ${stderr}`);
            return res.status(500).json({ error: 'Transcription failed' });
        }
        res.json({ text: stdout.trim() });
    });
});

// Check memory availability on startup
async function checkMemoryOnStartup() {
    if (CONFIG.MEMORY_ENABLED) {
        try {
            const stats = await memory.getMemoryStats();
            console.log(`Memory: Persistent memory enabled (${stats.totalUserData} user items, ${stats.totalCommands} commands)`);
        } catch (error) {
            console.log('Memory: Error initializing memory system - memory will be disabled');
            CONFIG.MEMORY_ENABLED = false;
        }
    } else {
        console.log('Memory: Persistent memory is disabled');
    }
}

// Check security system on startup
async function checkSecurityOnStartup() {
    if (CONFIG.SECURITY_ENABLED) {
        try {
            const stats = security.getSecurityStats();
            console.log(`Security: Sandboxing enabled (${stats.allowedCommands || security.getAllowedCommands().length} allowed commands, ${stats.blockedCommands || security.getBlockedCommands().length} blocked patterns)`);
            console.log(`Security: Log file: ${security.LOG_FILE}`);
        } catch (error) {
            console.log('Security: Error initializing security system - security will be disabled');
            CONFIG.SECURITY_ENABLED = false;
        }
    } else {
        console.log('Security: Security sandboxing is disabled');
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Command logging: ${CONFIG.LOG_COMMANDS ? 'enabled' : 'disabled'}`);
    console.log(`Working directory: ${WORKING_DIR}`);
    console.log(`File operations: enabled`);
    
    // Ensure working directory exists
    ensureWorkingDirectory();
    
    // Initialize systems asynchronously
    initializeSystems();
});

// Initialize systems asynchronously
async function initializeSystems() {
    try {
        // Initialize logging system
        await logger.ensureLogDirectory();
        await logger.logSystem('SERVER_START', 'SUCCESS', `VOICE-CMD server started on port ${PORT}`, {
            port: PORT,
            workingDir: WORKING_DIR,
            features: ['File Operations', 'Shell Commands', 'TTS Support', 'Speech-to-Text', 'Persistent Memory', 'Security Sandboxing']
        });
        
        await checkTTSOnStartup();
        await checkMemoryOnStartup();
        await checkSecurityOnStartup();
    } catch (error) {
        console.error('Error initializing systems:', error);
    }
}

module.exports = app;
