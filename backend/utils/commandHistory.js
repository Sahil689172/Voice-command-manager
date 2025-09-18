// Command History Management Utility
// Handles storing, retrieving, and managing command execution history

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const HISTORY_FILE = path.join(LOGS_DIR, 'commandHistory.json');

// Ensure logs directory exists
async function ensureLogsDirectory() {
    try {
        await fsPromises.mkdir(LOGS_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create logs directory:', error.message);
    }
}

// Load history from file
async function loadHistory() {
    try {
        await ensureLogsDirectory();
        
        if (!fs.existsSync(HISTORY_FILE)) {
            return [];
        }
        
        const data = await fsPromises.readFile(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading command history:', error.message);
        return [];
    }
}

// Save history to file
async function saveHistory(history) {
    try {
        await ensureLogsDirectory();
        await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving command history:', error.message);
    }
}

/**
 * Add a command to the history
 * @param {Object} commandData - Command data to store
 * @param {string} commandData.command - The command text
 * @param {string} commandData.status - Command status (success, error, blocked)
 * @param {string} commandData.result - Command result/output
 * @param {string} commandData.timestamp - ISO timestamp
 * @param {string} commandData.code - Error code (optional)
 * @returns {Promise<Object>} - The stored command with ID
 */
async function addCommand(commandData) {
    try {
        const history = await loadHistory();
        
        // Generate unique ID
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const commandEntry = {
            id,
            command: commandData.command,
            status: commandData.status,
            result: commandData.result,
            timestamp: commandData.timestamp || new Date().toISOString(),
            code: commandData.code || null,
            duration: commandData.duration || null
        };
        
        // Add to beginning of array (most recent first)
        history.unshift(commandEntry);
        
        // Keep only last 100 commands to prevent file from growing too large
        if (history.length > 100) {
            history.splice(100);
        }
        
        await saveHistory(history);
        
        console.log(`Command added to history: ${commandData.command} (${commandData.status})`);
        return commandEntry;
        
    } catch (error) {
        console.error('Error adding command to history:', error.message);
        return null;
    }
}

/**
 * Get command history
 * @param {number} limit - Maximum number of commands to return (default: 10)
 * @returns {Promise<Array>} - Array of command entries
 */
async function getHistory(limit = 10) {
    try {
        const history = await loadHistory();
        return history.slice(0, limit);
    } catch (error) {
        console.error('Error getting command history:', error.message);
        return [];
    }
}

/**
 * Get a specific command by ID
 * @param {string} id - Command ID
 * @returns {Promise<Object|null>} - Command entry or null if not found
 */
async function getCommandById(id) {
    try {
        const history = await loadHistory();
        return history.find(cmd => cmd.id === id) || null;
    } catch (error) {
        console.error('Error getting command by ID:', error.message);
        return null;
    }
}

/**
 * Clear command history
 * @returns {Promise<boolean>} - Success status
 */
async function clearHistory() {
    try {
        await ensureLogsDirectory();
        await fsPromises.writeFile(HISTORY_FILE, '[]', 'utf8');
        console.log('Command history cleared');
        return true;
    } catch (error) {
        console.error('Error clearing command history:', error.message);
        return false;
    }
}

/**
 * Get history statistics
 * @returns {Promise<Object>} - Statistics about command history
 */
async function getHistoryStats() {
    try {
        const history = await loadHistory();
        
        const stats = {
            totalCommands: history.length,
            successCount: history.filter(cmd => cmd.status === 'success').length,
            errorCount: history.filter(cmd => cmd.status === 'error').length,
            blockedCount: history.filter(cmd => cmd.status === 'blocked').length,
            lastCommand: history[0] || null,
            oldestCommand: history[history.length - 1] || null
        };
        
        return stats;
    } catch (error) {
        console.error('Error getting history stats:', error.message);
        return {
            totalCommands: 0,
            successCount: 0,
            errorCount: 0,
            blockedCount: 0,
            lastCommand: null,
            oldestCommand: null
        };
    }
}

/**
 * Search command history
 * @param {string} query - Search query
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} - Matching command entries
 */
async function searchHistory(query, limit = 10) {
    try {
        const history = await loadHistory();
        const searchTerm = query.toLowerCase();
        
        const results = history.filter(cmd => 
            cmd.command.toLowerCase().includes(searchTerm) ||
            (cmd.result && cmd.result.toLowerCase().includes(searchTerm))
        );
        
        return results.slice(0, limit);
    } catch (error) {
        console.error('Error searching command history:', error.message);
        return [];
    }
}

// User-specific functions
async function addCommandForUser(username, commandData) {
    try {
        const auth = require('./auth');
        await auth.ensureUserDataDir(username);
        
        const historyFile = auth.getUserCommandHistoryFile(username);
        const history = await loadUserHistory(historyFile);
        
        // Generate unique ID
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const commandEntry = {
            id,
            command: commandData.command,
            status: commandData.status,
            result: commandData.result,
            timestamp: commandData.timestamp || new Date().toISOString(),
            code: commandData.code || null,
            duration: commandData.duration || null,
            username: username
        };
        
        // Add to beginning of array (most recent first)
        history.unshift(commandEntry);
        
        // Keep only last 100 commands to prevent file from growing too large
        if (history.length > 100) {
            history.splice(100);
        }
        
        await saveUserHistory(historyFile, history);
        
        console.log(`Command added to history for user ${username}: ${commandData.command} (${commandData.status})`);
        return commandEntry;
        
    } catch (error) {
        console.error('Error adding command to user history:', error.message);
        return null;
    }
}

async function getHistoryForUser(username, limit = 10) {
    try {
        const auth = require('./auth');
        const historyFile = auth.getUserCommandHistoryFile(username);
        const history = await loadUserHistory(historyFile);
        return history.slice(0, limit);
    } catch (error) {
        console.error('Error getting user command history:', error.message);
        return [];
    }
}

async function clearHistoryForUser(username) {
    try {
        const auth = require('./auth');
        const historyFile = auth.getUserCommandHistoryFile(username);
        await fsPromises.writeFile(historyFile, '[]', 'utf8');
        console.log(`Command history cleared for user: ${username}`);
        return true;
    } catch (error) {
        console.error('Error clearing user command history:', error.message);
        return false;
    }
}

async function loadUserHistory(historyFile) {
    try {
        if (!fs.existsSync(historyFile)) {
            return [];
        }
        
        const data = await fsPromises.readFile(historyFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading user history:', error.message);
        return [];
    }
}

async function saveUserHistory(historyFile, history) {
    try {
        await fsPromises.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving user history:', error.message);
    }
}

module.exports = {
    addCommand,
    getHistory,
    getCommandById,
    clearHistory,
    getHistoryStats,
    searchHistory,
    addCommandForUser,
    getHistoryForUser,
    clearHistoryForUser,
    HISTORY_FILE
};
