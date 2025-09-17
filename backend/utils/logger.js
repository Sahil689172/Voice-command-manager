// VOICE-CMD Enhanced Logging System
// Structured logging with rotation and better formatting

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), 'Desktop', 'VOICE-CMD', 'logs');
const COMMAND_LOG_FILE = path.join(LOG_DIR, 'commands.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;

// Ensure log directory exists
async function ensureLogDirectory() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create log directory:', error.message);
    }
}

// Rotate log file if it gets too large
async function rotateLogFile(logFile) {
    try {
        const stats = await fs.stat(logFile);
        if (stats.size > MAX_LOG_SIZE) {
            const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
            
            // Move current log to rotated file
            await fs.rename(logFile, rotatedFile);
            
            // Clean up old log files
            await cleanupOldLogs();
            
            console.log(`Log rotated: ${path.basename(logFile)} -> ${path.basename(rotatedFile)}`);
        }
    } catch (error) {
        console.error('Log rotation failed:', error.message);
    }
}

// Clean up old log files
async function cleanupOldLogs() {
    try {
        const files = await fs.readdir(LOG_DIR);
        const logFiles = files
            .filter(file => file.startsWith('commands-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(LOG_DIR, file),
                mtime: 0
            }));

        // Get file stats
        for (const file of logFiles) {
            try {
                const stats = await fs.stat(file.path);
                file.mtime = stats.mtime.getTime();
            } catch (error) {
                // File might not exist, skip
            }
        }

        // Sort by modification time (oldest first)
        logFiles.sort((a, b) => a.mtime - b.mtime);

        // Remove old files if we have too many
        if (logFiles.length > MAX_LOG_FILES) {
            const filesToDelete = logFiles.slice(0, logFiles.length - MAX_LOG_FILES);
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                    console.log(`Deleted old log file: ${file.name}`);
                } catch (error) {
                    console.error(`Failed to delete log file ${file.name}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('Log cleanup failed:', error.message);
    }
}

// Enhanced log entry structure
class LogEntry {
    constructor(type, command, status, message, details = {}) {
        this.timestamp = new Date().toISOString();
        this.type = type; // 'COMMAND', 'SECURITY', 'ERROR', 'SYSTEM'
        this.command = command;
        this.status = status; // 'SUCCESS', 'BLOCKED', 'ERROR', 'WARNING'
        this.message = message;
        this.details = details;
        this.sessionId = details.sessionId || 'default';
        this.userAgent = details.userAgent || 'VOICE-CMD';
    }

    toJSON() {
        return {
            timestamp: this.timestamp,
            type: this.type,
            command: this.command,
            status: this.status,
            message: this.message,
            sessionId: this.sessionId,
            userAgent: this.userAgent,
            details: this.details
        };
    }

    toString() {
        return `${this.timestamp} | ${this.type} | ${this.status} | ${this.command} | ${this.message}`;
    }
}

// Log a command execution
async function logCommand(command, status, message, details = {}) {
    await ensureLogDirectory();
    
    const logEntry = new LogEntry('COMMAND', command, status, message, details);
    const logLine = logEntry.toString() + '\n';
    
    try {
        await fs.appendFile(COMMAND_LOG_FILE, logLine, 'utf8');
        
        // Check if we need to rotate the log
        await rotateLogFile(COMMAND_LOG_FILE);
        
        // Console output with colors
        const statusColor = getStatusColor(status);
        console.log(`${statusColor}${logEntry.toString()}\x1b[0m`);
        
    } catch (error) {
        console.error('Failed to write to log file:', error.message);
    }
}

// Log security events
async function logSecurity(command, status, message, details = {}) {
    await ensureLogDirectory();
    
    const logEntry = new LogEntry('SECURITY', command, status, message, details);
    const logLine = logEntry.toString() + '\n';
    
    try {
        await fs.appendFile(COMMAND_LOG_FILE, logLine, 'utf8');
        
        // Console output with security colors
        const securityColor = status === 'BLOCKED' ? '\x1b[31m' : '\x1b[33m'; // Red for blocked, yellow for allowed
        console.log(`${securityColor}🔒 SECURITY: ${logEntry.toString()}\x1b[0m`);
        
    } catch (error) {
        console.error('Failed to write security log:', error.message);
    }
}

// Log system events
async function logSystem(event, status, message, details = {}) {
    await ensureLogDirectory();
    
    const logEntry = new LogEntry('SYSTEM', event, status, message, details);
    const logLine = logEntry.toString() + '\n';
    
    try {
        await fs.appendFile(COMMAND_LOG_FILE, logLine, 'utf8');
        
        // Console output
        console.log(`🔧 SYSTEM: ${logEntry.toString()}`);
        
    } catch (error) {
        console.error('Failed to write system log:', error.message);
    }
}

// Get color for status
function getStatusColor(status) {
    switch (status) {
        case 'SUCCESS':
            return '\x1b[32m'; // Green
        case 'BLOCKED':
            return '\x1b[31m'; // Red
        case 'ERROR':
            return '\x1b[31m'; // Red
        case 'WARNING':
            return '\x1b[33m'; // Yellow
        default:
            return '\x1b[37m'; // White
    }
}

// Get log statistics
async function getLogStats() {
    try {
        await ensureLogDirectory();
        
        const files = await fs.readdir(LOG_DIR);
        const logFiles = files.filter(file => file.endsWith('.log'));
        
        let totalEntries = 0;
        let successCount = 0;
        let blockedCount = 0;
        let errorCount = 0;
        
        for (const file of logFiles) {
            try {
                const content = await fs.readFile(path.join(LOG_DIR, file), 'utf8');
                const lines = content.trim().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    totalEntries++;
                    if (line.includes('| SUCCESS |')) successCount++;
                    else if (line.includes('| BLOCKED |')) blockedCount++;
                    else if (line.includes('| ERROR |')) errorCount++;
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        return {
            totalEntries,
            successCount,
            blockedCount,
            errorCount,
            logFiles: logFiles.length,
            logDirectory: LOG_DIR
        };
    } catch (error) {
        return {
            error: `Failed to get log stats: ${error.message}`
        };
    }
}

// Clear all logs
async function clearLogs() {
    try {
        await ensureLogDirectory();
        
        const files = await fs.readdir(LOG_DIR);
        const logFiles = files.filter(file => file.endsWith('.log'));
        
        for (const file of logFiles) {
            await fs.unlink(path.join(LOG_DIR, file));
        }
        
        console.log(`Cleared ${logFiles.length} log files`);
        return { success: true, clearedFiles: logFiles.length };
    } catch (error) {
        console.error('Failed to clear logs:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    logCommand,
    logSecurity,
    logSystem,
    getLogStats,
    clearLogs,
    ensureLogDirectory
};


