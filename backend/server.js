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
const commandHistory = require('./utils/commandHistory'); // Command history management
const scheduler = require('./utils/scheduler'); // Command scheduler
const auth = require('./utils/auth'); // Authentication and user management
const wsManager = require('./utils/ws'); // WebSocket real-time communication

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
app.post('/command', auth.requireAuth, async (req, res) => {
    try {
        const { commandText } = req.body;
        
        // Validate that commandText exists
        if (!commandText) {
            return res.status(400).json({
                status: "error",
                message: "Missing commandText in request body",
                code: "E_MISSING_COMMAND",
                data: {
                    command: "",
                    result: null,
                    error: "Missing commandText in request body"
                }
            });
        }
        
        // Validate commandText is not empty or just whitespace
        if (!commandText.trim()) {
            return res.status(400).json({
                status: "error",
                message: "Command cannot be empty",
                code: "E_EMPTY_COMMAND",
                data: {
                    command: commandText,
                    result: null,
                    error: "Command cannot be empty"
                }
            });
        }
        
        // Execute the command using the new command utils
        const result = await commandUtils.executeCommand(commandText);
        
        // Enhanced logging
        if (CONFIG.LOG_COMMANDS) {
            const logStatus = result.success ? 'SUCCESS' : (result.blocked ? 'BLOCKED' : 'ERROR');
            logger.logCommand(
                commandText,
                logStatus,
                result.result
            );
        }
        
        // Add to command history (user-specific)
        const timestamp = new Date().toISOString();
        await commandHistory.addCommandForUser(req.user.username, {
            command: commandText,
            status: result.success ? 'success' : (result.blocked ? 'blocked' : 'error'),
            result: result.result,
            timestamp: timestamp,
            code: result.code || null
        });

        // Broadcast command executed event via WebSocket
        wsManager.broadcastCommandExecuted(
            req.user.username,
            commandText,
                result.result,
            result.success ? 'success' : (result.blocked ? 'blocked' : 'error')
        );
        
        // Text-to-Speech (if enabled) - with error handling
        if (CONFIG.TTS_ENABLED && result.success) {
            tts.speakText(result.result).catch(ttsError => {
                console.log('TTS: Error speaking text:', ttsError.message);
                // Don't fail the request if TTS fails
            });
        }
        
        // Determine response status and message with error codes
        let status, message, code;
        if (result.blocked) {
            status = "blocked";
            message = "Command blocked by security rules";
            code = "E_COMMAND_BLOCKED";
        } else if (result.success) {
            status = "success";
            message = result.result || "Command executed successfully";
            code = "SUCCESS";
        } else {
            status = "error";
            message = result.result || "Command execution failed";
            code = result.code || "E_COMMAND_FAILED";
        }
        
        // Return consistent JSON response
        res.json({
            status: status,
            message: message,
            code: code,
            data: {
                command: commandText,
                result: result.success ? result.result : null,
                error: result.success ? null : (result.result || "Unknown error")
            }
        });
        
    } catch (error) {
        console.error('Error processing command:', error);
        
        // Determine error code based on error type
        let errorCode = "E_INTERNAL_ERROR";
        if (error.name === 'SyntaxError') {
            errorCode = "E_SYNTAX_ERROR";
        } else if (error.code === 'ENOENT') {
            errorCode = "E_FILE_NOT_FOUND";
        } else if (error.code === 'EACCES') {
            errorCode = "E_PERMISSION_DENIED";
        }
        
        res.status(500).json({
            status: "error",
            message: `Internal server error: ${error.message}`,
            code: errorCode,
            data: {
                command: req.body.commandText || "unknown",
                result: null,
                error: error.message
            }
        });
    }
});

// Command History Endpoints

// GET /history - Get command history
app.get('/history', auth.requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = await commandHistory.getHistoryForUser(req.user.username, limit);
        
        res.json({
            status: "success",
            message: `Retrieved ${history.length} commands from history`,
            data: {
                commands: history,
                total: history.length,
                limit: limit
            }
        });
    } catch (error) {
        console.error('Error getting command history:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to retrieve command history: ${error.message}`,
            code: "E_HISTORY_RETRIEVAL_FAILED",
            data: {
                commands: [],
                total: 0,
                limit: 0
            }
        });
    }
});

// POST /history/clear - Clear command history
app.post('/history/clear', auth.requireAuth, async (req, res) => {
    try {
        const success = await commandHistory.clearHistoryForUser(req.user.username);
        
        if (success) {
            // Broadcast history cleared event
            wsManager.broadcastHistoryUpdated(req.user.username, 'cleared', null);
            
            res.json({
                status: "success",
                message: "Command history cleared successfully",
                data: {
                    cleared: true
                }
            });
        } else {
            res.status(500).json({
                status: "error",
                message: "Failed to clear command history",
                code: "E_HISTORY_CLEAR_FAILED",
                data: {
                    cleared: false
                }
            });
        }
    } catch (error) {
        console.error('Error clearing command history:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to clear command history: ${error.message}`,
            code: "E_HISTORY_CLEAR_FAILED",
            data: {
                cleared: false
            }
        });
    }
});

// POST /history/reexecute - Re-execute a command from history
app.post('/history/reexecute', auth.requireAuth, async (req, res) => {
    try {
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({
                status: "error",
                message: "Missing command ID in request body",
                code: "E_MISSING_COMMAND_ID",
                data: {
                    command: null,
                    result: null,
                    error: "Missing command ID in request body"
                }
            });
        }
        
        // Get the command from history
        const commandEntry = await commandHistory.getCommandById(id);
        
        if (!commandEntry) {
            return res.status(404).json({
                status: "error",
                message: "Command not found in history",
                code: "E_COMMAND_NOT_FOUND",
                data: {
                    command: null,
                    result: null,
                    error: "Command not found in history"
                }
            });
        }
        
        // Re-execute the command
        const result = await commandUtils.executeCommand(commandEntry.command);
        
        // Add to history again
        const timestamp = new Date().toISOString();
        await commandHistory.addCommand({
            command: commandEntry.command,
            status: result.success ? 'success' : (result.blocked ? 'blocked' : 'error'),
            result: result.result,
            timestamp: timestamp,
            code: result.code || null
        });
        
        // Enhanced logging
        if (CONFIG.LOG_COMMANDS) {
            const logStatus = result.success ? 'SUCCESS' : (result.blocked ? 'BLOCKED' : 'ERROR');
            logger.logCommand(
                commandEntry.command,
                logStatus,
                result.result
            );
        }
        
        // Text-to-Speech (if enabled)
        if (CONFIG.TTS_ENABLED && result.success) {
            tts.speakText(result.result).catch(ttsError => {
                console.log('TTS: Error speaking text:', ttsError.message);
            });
        }
        
        // Determine response status and message
        let status, message, code;
        if (result.blocked) {
            status = "blocked";
            message = "Command blocked by security rules";
            code = "E_COMMAND_BLOCKED";
        } else if (result.success) {
            status = "success";
            message = result.result || "Command executed successfully";
            code = "SUCCESS";
        } else {
            status = "error";
            message = result.result || "Command execution failed";
            code = result.code || "E_COMMAND_FAILED";
        }
        
        // Return consistent JSON response
        res.json({
            status: status,
            message: message,
            code: code,
            data: {
                command: commandEntry.command,
                result: result.success ? result.result : null,
                error: result.success ? null : (result.result || "Unknown error"),
                reexecuted: true,
                originalId: id
            }
        });
        
    } catch (error) {
        console.error('Error re-executing command:', error);
        
        let errorCode = "E_INTERNAL_ERROR";
        if (error.name === 'SyntaxError') {
            errorCode = "E_SYNTAX_ERROR";
        } else if (error.code === 'ENOENT') {
            errorCode = "E_FILE_NOT_FOUND";
        } else if (error.code === 'EACCES') {
            errorCode = "E_PERMISSION_DENIED";
        }
        
        res.status(500).json({
            status: "error",
            message: `Internal server error: ${error.message}`,
            code: errorCode,
            data: {
                command: req.body.command || "unknown",
                result: null,
                error: error.message,
                reexecuted: false
            }
        });
    }
});

// GET /history/stats - Get command history statistics
app.get('/history/stats', auth.requireAuth, async (req, res) => {
    try {
        const stats = await commandHistory.getHistoryStats();
        
        res.json({
            status: "success",
            message: "Command history statistics retrieved",
            data: stats
        });
    } catch (error) {
        console.error('Error getting history stats:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to retrieve history statistics: ${error.message}`,
            code: "E_HISTORY_STATS_FAILED",
            data: {
                totalCommands: 0,
                successCount: 0,
                errorCount: 0,
                blockedCount: 0,
                lastCommand: null,
                oldestCommand: null
            }
        });
    }
});

// Command Scheduler Endpoints

// POST /schedule - Create a new scheduled job
app.post('/schedule', auth.requireAuth, async (req, res) => {
    try {
        const { command, time, repeat = 'once', description = '' } = req.body;
        
        if (!command) {
            return res.status(400).json({
                status: "error",
                message: "Missing command in request body",
                code: "E_MISSING_COMMAND",
                data: {
                    scheduleId: null,
                    message: "Missing command in request body"
                }
            });
        }
        
        if (!time) {
            return res.status(400).json({
                status: "error",
                message: "Missing time in request body",
                code: "E_MISSING_TIME",
                data: {
                    scheduleId: null,
                    message: "Missing time in request body"
                }
            });
        }
        
        // Validate repeat value
        const validRepeats = ['once', 'daily', 'weekly', 'hourly'];
        if (!validRepeats.includes(repeat)) {
            return res.status(400).json({
                status: "error",
                message: `Invalid repeat value. Must be one of: ${validRepeats.join(', ')}`,
                code: "E_INVALID_REPEAT",
                data: {
                    scheduleId: null,
                    message: `Invalid repeat value: ${repeat}`
                }
            });
        }
        
        const result = await scheduler.scheduleCommand({
            command,
            time,
            repeat,
            description
        });
        
        if (result.success) {
            // Broadcast schedule created event
            wsManager.broadcastLogEvent(req.user.username, 'info', `Schedule created: ${command}`, {
                scheduleId: result.scheduleId,
                command: command,
                time: time,
                repeat: repeat
            });
            
            res.json({
                status: "success",
                message: result.message,
                data: {
                    scheduleId: result.scheduleId,
                    schedule: result.schedule,
                    message: result.message
                }
            });
        } else {
            res.status(500).json({
                status: "error",
                message: result.message,
                code: result.code || "E_SCHEDULE_FAILED",
                data: {
                    scheduleId: null,
                    message: result.message
                }
            });
        }
        
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({
            status: "error",
            message: `Internal server error: ${error.message}`,
            code: "E_INTERNAL_ERROR",
            data: {
                scheduleId: null,
                message: `Internal server error: ${error.message}`
            }
        });
    }
});

// GET /schedule - List all scheduled jobs
app.get('/schedule', auth.requireAuth, async (req, res) => {
    try {
        const result = await scheduler.listSchedules();
        
        if (result.success) {
            res.json({
                status: "success",
                message: `Retrieved ${result.total} scheduled jobs`,
                data: {
                    schedules: result.schedules,
                    total: result.total,
                    active: result.active,
                    completed: result.completed,
                    cancelled: result.cancelled
                }
            });
        } else {
            res.status(500).json({
                status: "error",
                message: result.message,
                code: "E_SCHEDULE_LIST_FAILED",
                data: {
                    schedules: [],
                    total: 0,
                    active: 0,
                    completed: 0,
                    cancelled: 0
                }
            });
        }
        
    } catch (error) {
        console.error('Error listing schedules:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to list schedules: ${error.message}`,
            code: "E_SCHEDULE_LIST_FAILED",
            data: {
                schedules: [],
                total: 0,
                active: 0,
                completed: 0,
                cancelled: 0
            }
        });
    }
});

// POST /schedule/cancel - Cancel a scheduled job
app.post('/schedule/cancel', auth.requireAuth, async (req, res) => {
    try {
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({
                status: "error",
                message: "Missing schedule ID in request body",
                code: "E_MISSING_SCHEDULE_ID",
                data: {
                    cancelled: false,
                    message: "Missing schedule ID in request body"
                }
            });
        }
        
        const result = await scheduler.cancelSchedule(id);
        
        if (result.success) {
            // Broadcast schedule cancelled event
            wsManager.broadcastLogEvent(req.user.username, 'info', `Schedule cancelled: ${id}`, {
                scheduleId: id
            });
            
            res.json({
                status: "success",
                message: result.message,
                data: {
                    cancelled: true,
                    scheduleId: id,
                    message: result.message
                }
            });
        } else {
            res.status(404).json({
                status: "error",
                message: result.message,
                code: result.code || "E_CANCEL_SCHEDULE_FAILED",
                data: {
                    cancelled: false,
                    scheduleId: id,
                    message: result.message
                }
            });
        }
        
    } catch (error) {
        console.error('Error cancelling schedule:', error);
        res.status(500).json({
            status: "error",
            message: `Internal server error: ${error.message}`,
            code: "E_INTERNAL_ERROR",
            data: {
                cancelled: false,
                message: `Internal server error: ${error.message}`
            }
        });
    }
});

// GET /schedule/stats - Get scheduler statistics
app.get('/schedule/stats', auth.requireAuth, async (req, res) => {
    try {
        const stats = await scheduler.getScheduleStats();
        
        res.json({
            status: "success",
            message: "Scheduler statistics retrieved",
            data: stats
        });
        
    } catch (error) {
        console.error('Error getting schedule stats:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to retrieve scheduler statistics: ${error.message}`,
            code: "E_SCHEDULE_STATS_FAILED",
            data: {
                total: 0,
                active: 0,
                completed: 0,
                cancelled: 0,
                overdue: 0,
                nextExecution: null
            }
        });
    }
});

// Authentication Endpoints

// POST /auth/register - Register a new user
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Username and password are required",
                code: "E_MISSING_CREDENTIALS",
                data: {
                    user: null,
                    token: null
                }
            });
        }
        
        const result = await auth.registerUser(username, password);
        
        if (result.success) {
            res.status(201).json({
                status: "success",
                message: result.message,
                data: {
                    user: result.user,
                    token: null
                }
            });
        } else {
            res.status(400).json({
                status: "error",
                message: result.message,
                code: result.code,
                data: {
                    user: null,
                    token: null
                }
            });
        }
        
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({
            status: "error",
            message: `Registration failed: ${error.message}`,
            code: "E_REGISTRATION_FAILED",
            data: {
                user: null,
                token: null
            }
        });
    }
});

// POST /auth/login - Authenticate user and return JWT
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Username and password are required",
                code: "E_MISSING_CREDENTIALS",
                data: {
                    user: null,
                    token: null
                }
            });
        }
        
        const authResult = await auth.authenticateUser(username, password);
        
        if (!authResult.success) {
            return res.status(401).json({
                status: "error",
                message: authResult.message,
                code: authResult.code,
                data: {
                    user: null,
                    token: null
                }
            });
        }
        
        const tokenResult = auth.issueToken(authResult.user);
        
        if (!tokenResult.success) {
            return res.status(500).json({
                status: "error",
                message: tokenResult.message,
                code: tokenResult.code,
                data: {
                    user: null,
                    token: null
                }
            });
        }
        
        res.json({
            status: "success",
            message: "Login successful",
            data: {
                user: authResult.user,
                token: tokenResult.token,
                expiresIn: tokenResult.expiresIn
            }
        });
        
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({
            status: "error",
            message: `Login failed: ${error.message}`,
            code: "E_LOGIN_FAILED",
            data: {
                user: null,
                token: null
            }
        });
    }
});

// GET /auth/me - Get current user info from token
app.get('/auth/me', auth.requireAuth, async (req, res) => {
    try {
        const userInfo = await auth.getUserInfo(req.headers.authorization);
        
        if (userInfo.success) {
            res.json({
                status: "success",
                message: "User info retrieved",
                data: {
                    user: userInfo.user
                }
            });
        } else {
            res.status(401).json({
                status: "error",
                message: userInfo.message,
                code: userInfo.code,
                data: {
                    user: null
                }
            });
        }
        
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({
            status: "error",
            message: `Failed to get user info: ${error.message}`,
            code: "E_GET_USER_INFO_FAILED",
            data: {
                user: null
            }
        });
    }
});

// POST /auth/logout - Logout user (client-side token removal)
app.post('/auth/logout', auth.requireAuth, (req, res) => {
    res.json({
        status: "success",
        message: "Logout successful",
        data: {
            loggedOut: true
        }
    });
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
const server = app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Command logging: ${CONFIG.LOG_COMMANDS ? 'enabled' : 'disabled'}`);
    console.log(`Working directory: ${WORKING_DIR}`);
    console.log(`File operations: enabled`);
    
    // Initialize WebSocket server
    wsManager.initialize(server);
    wsManager.startHeartbeat();
    
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
        await scheduler.initializeScheduler();
    } catch (error) {
        console.error('Error initializing systems:', error);
    }
}

module.exports = app;
