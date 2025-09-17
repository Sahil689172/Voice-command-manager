// VOICE-CMD Security Module
// Lightweight security layer for personal use with command sandboxing

const fs = require('fs');
const path = require('path');
const os = require('os');

// Project configuration
const PROJECT_ROOT = path.join(os.homedir(), 'Desktop', 'VOICE-CMD');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'security.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

// ✅ Allowlist & Denylist for commands
const allowedCommands = [
    // File operations
    'mkdir', 'touch', 'ls', 'cp', 'mv', 'cat', 'head', 'tail', 'grep', 'find',
    'chmod', 'chown', 'tar', 'zip', 'unzip', 'gzip', 'gunzip',
    
    // Text editing
    'nano', 'vim', 'vi', 'emacs',
    
    // System info
    'pwd', 'whoami', 'uname', 'df', 'du', 'free', 'uptime', 'ps', 'top', 'htop',
    
    // Network
    'ping', 'curl', 'wget', 'ssh', 'scp',
    
    // Development
    'git', 'npm', 'node', 'python', 'python3', 'gcc', 'g++', 'make',
    
    // Utilities
    'echo', 'date', 'cal', 'which', 'whereis', 'man', 'info', 'help'
];

const blockedCommands = [
    // Dangerous system commands
    'rm -rf', 'rm -r', 'rm -f', 'shutdown', 'reboot', 'halt', 'poweroff',
    'init 0', 'init 6', 'systemctl poweroff', 'systemctl reboot',
    
    // Dangerous file operations
    'chmod 777 /', 'chmod 777 /etc', 'chmod 777 /root', 'chmod 777 /home',
    'chown root:', 'chown root /', 'chown root /etc',
    
    // Process killing
    'kill -9 1', 'killall', 'pkill -f systemd', 'killall systemd',
    
    // Network attacks
    'nmap', 'nmap -sS', 'nmap -O', 'netcat', 'nc -l', 'nc -e',
    
    // File system damage
    'dd if=/dev/zero', 'dd of=/dev/sda', 'mkfs', 'fdisk', 'parted',
    'format', 'wipefs', 'badblocks',
    
    // Privilege escalation
    'sudo su', 'sudo -i', 'su -', 'su root', 'passwd root',
    
    // Dangerous redirects
    '> /dev/sda', '> /etc/passwd', '> /etc/shadow', '>> /etc/passwd',
    
    // Script execution
    'bash -c', 'sh -c', 'eval', 'exec', 'source /dev/stdin'
];

const blockedPatterns = [
    // Regex patterns for more complex blocking
    /rm\s+-rf?\s+\//,  // rm -rf /
    /chmod\s+777\s+\//,  // chmod 777 /
    /chown\s+root\s+\//,  // chown root /
    /dd\s+if=.*of=\/dev/,  // dd to block devices
    /sudo\s+(su|passwd|visudo)/,  // sudo dangerous commands
    /kill\s+-9\s+[0-9]+/,  // kill -9 with PID
    />.*\/etc\/(passwd|shadow|hosts)/,  // redirect to system files
    /bash\s+-c\s+['"]/,  // bash -c with quotes
    /eval\s+/,  // eval commands
    /exec\s+/,  // exec commands
    /source\s+\/dev\/stdin/  // source from stdin
];

/**
 * Check if command is safe to execute
 * @param {string} command - Command to check
 * @returns {Object} - Safety result with details
 */
function isCommandSafe(command) {
    if (!command || typeof command !== 'string') {
        return {
            safe: false,
            reason: 'Invalid command format',
            blocked: true
        };
    }

    const trimmedCommand = command.trim().toLowerCase();
    
    // Check against blocked commands
    for (const blocked of blockedCommands) {
        if (trimmedCommand.includes(blocked.toLowerCase())) {
            return {
                safe: false,
                reason: `Command contains blocked pattern: "${blocked}"`,
                blocked: true,
                pattern: blocked
            };
        }
    }

    // Check against blocked regex patterns
    for (const pattern of blockedPatterns) {
        if (pattern.test(command)) {
            return {
                safe: false,
                reason: `Command matches blocked pattern: ${pattern}`,
                blocked: true,
                pattern: pattern.toString()
            };
        }
    }

    // Extract base command (first word)
    const baseCommand = trimmedCommand.split(' ')[0];
    
    // Check if base command is in allowlist
    if (!allowedCommands.includes(baseCommand)) {
        return {
            safe: false,
            reason: `Command "${baseCommand}" not in allowlist`,
            blocked: true,
            suggestion: `Try one of these: ${allowedCommands.slice(0, 5).join(', ')}...`
        };
    }

    // Additional safety checks
    if (trimmedCommand.includes('&&') || trimmedCommand.includes('||') || trimmedCommand.includes(';')) {
        return {
            safe: false,
            reason: 'Command chaining not allowed for security',
            blocked: true
        };
    }

    if (trimmedCommand.includes('$(') || trimmedCommand.includes('`')) {
        return {
            safe: false,
            reason: 'Command substitution not allowed for security',
            blocked: true
        };
    }

    return {
        safe: true,
        reason: 'Command is safe',
        blocked: false
    };
}

/**
 * Ensure paths stay within project boundaries
 * @param {string} userPath - Path to check
 * @returns {Object} - Path safety result
 */
function isPathSafe(userPath) {
    if (!userPath || typeof userPath !== 'string') {
        return {
            safe: false,
            reason: 'Invalid path format',
            blocked: true
        };
    }

    try {
        const resolvedPath = path.resolve(PROJECT_ROOT, userPath);
        const isWithinProject = resolvedPath.startsWith(PROJECT_ROOT);
        
        if (!isWithinProject) {
            return {
                safe: false,
                reason: `Path "${userPath}" is outside project directory`,
                blocked: true,
                resolvedPath: resolvedPath,
                projectRoot: PROJECT_ROOT
            };
        }

        return {
            safe: true,
            reason: 'Path is within project boundaries',
            blocked: false,
            resolvedPath: resolvedPath
        };
    } catch (error) {
        return {
            safe: false,
            reason: `Path resolution error: ${error.message}`,
            blocked: true
        };
    }
}

/**
 * Log command executions for security auditing
 * @param {string} command - Command that was executed
 * @param {string} status - Execution status (SUCCESS, BLOCKED, ERROR)
 * @param {string} reason - Reason for blocking or error details
 * @param {Object} userInfo - Additional user context
 */
function logCommand(command, status, reason = '', userInfo = {}) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp: timestamp,
            command: command,
            status: status,
            reason: reason,
            userInfo: userInfo,
            projectRoot: PROJECT_ROOT
        };
        
        const logLine = `${timestamp} | ${status} | ${command} | ${reason}\n`;
        fs.appendFileSync(LOG_FILE, logLine, 'utf8');
        
        // Also log to console for immediate feedback
        if (status === 'BLOCKED') {
            console.log(`🚫 SECURITY: Command blocked - ${command} | Reason: ${reason}`);
        } else if (status === 'ERROR') {
            console.log(`❌ SECURITY: Command error - ${command} | Reason: ${reason}`);
        } else {
            console.log(`✅ SECURITY: Command allowed - ${command}`);
        }
    } catch (error) {
        console.error('Security logging error:', error.message);
    }
}

/**
 * Get security statistics
 * @returns {Object} - Security stats
 */
function getSecurityStats() {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            return {
                totalCommands: 0,
                blockedCommands: 0,
                successfulCommands: 0,
                errorCommands: 0,
                lastActivity: null
            };
        }

        const logContent = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = logContent.trim().split('\n').filter(line => line.trim());
        
        let blockedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        let lastActivity = null;

        for (const line of lines) {
            if (line.includes('| BLOCKED |')) blockedCount++;
            else if (line.includes('| SUCCESS |')) successCount++;
            else if (line.includes('| ERROR |')) errorCount++;
            
            // Extract timestamp from first part of line
            const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
            if (timestampMatch) {
                lastActivity = timestampMatch[1];
            }
        }

        return {
            totalCommands: lines.length,
            blockedCommands: blockedCount,
            successfulCommands: successCount,
            errorCommands: errorCount,
            lastActivity: lastActivity,
            logFile: LOG_FILE
        };
    } catch (error) {
        return {
            error: `Failed to read security stats: ${error.message}`
        };
    }
}

/**
 * Get allowed commands list
 * @returns {Array} - List of allowed commands
 */
function getAllowedCommands() {
    return [...allowedCommands];
}

/**
 * Get blocked commands list
 * @returns {Array} - List of blocked commands
 */
function getBlockedCommands() {
    return [...blockedCommands];
}

module.exports = {
    isCommandSafe,
    isPathSafe,
    logCommand,
    getSecurityStats,
    getAllowedCommands,
    getBlockedCommands,
    PROJECT_ROOT,
    LOG_FILE
};


