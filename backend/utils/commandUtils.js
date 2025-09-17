// VOICE-CMD Command Utilities
// Updated to handle file operations and shell commands

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const commandParser = require('./commandParser');
const FileOperations = require('./fileOps');
const memory = require('../memory');
const security = require('./security');

// VOICE-CMD working directory
const WORKING_DIR = path.join(os.homedir(), 'Desktop', 'VOICE-CMD');

/**
 * Map Command to Shell (Legacy function - keeping for compatibility)
 * @param {string} commandText - The voice command received from frontend
 * @returns {string} - Mapped Linux shell command
 */
function mapCommandToShell(commandText) {
    console.log(`Mapping command: "${commandText}"`);
    
    // Convert to lowercase for easier matching
    const command = commandText.toLowerCase().trim();
    
    // Map common voice commands to Linux commands
    if (command.includes('create directory') || command.includes('create a directory')) {
        const match = command.match(/create\s+(?:a\s+)?directory\s+(.+)/);
        const dirName = match ? match[1].trim() : 'new_directory';
        return `mkdir ${dirName}`;
    }
    
    if (command.includes('create file') || command.includes('create a file')) {
        const match = command.match(/create\s+(?:a\s+)?file\s+(.+)/);
        const fileName = match ? match[1].trim() : 'new_file.txt';
        return `touch ${fileName}`;
    }
    
    if (command.includes('delete file') || command.includes('remove file')) {
        const match = command.match(/(?:delete|remove)\s+file\s+(.+)/);
        const fileName = match ? match[1].trim() : 'file_to_delete';
        return `rm ${fileName}`;
    }
    
    if (command.includes('move file') || command.includes('move')) {
        const match = command.match(/move\s+(?:file\s+)?(.+?)\s+to\s+(.+)/);
        if (match) {
            const source = match[1].trim();
            const destination = match[2].trim();
            return `mv ${source} ${destination}`;
        }
        return 'mv source_file destination_file';
    }
    
    if (command.includes('copy file') || command.includes('copy')) {
        const match = command.match(/copy\s+(?:file\s+)?(.+?)\s+to\s+(.+)/);
        if (match) {
            const source = match[1].trim();
            const destination = match[2].trim();
            return `cp ${source} ${destination}`;
        }
        return 'cp source_file destination_file';
    }
    
    if (command.includes('list processes') || command.includes('show processes') || command.includes('running processes')) {
        return 'ps -aux';
    }
    
    if (command.includes('kill process')) {
        const match = command.match(/kill\s+process\s+(\d+)/);
        const pid = match ? match[1] : 'PID';
        return `kill ${pid}`;
    }
    
    if (command.includes('open nano') || command.includes('nano')) {
        const match = command.match(/open\s+nano\s+(.+)/);
        const fileName = match ? match[1].trim() : 'filename.txt';
        return `nano ${fileName}`;
    }
    
    if (command.includes('save file')) {
        return 'nano_save_keystrokes'; // Placeholder for nano save sequence
    }
    
    if (command.includes('list files') || command.includes('list all files') || command.includes('show files')) {
        return 'ls -la';
    }
    
    // Default case - return original command if no mapping found
    console.log(`No mapping found for command: "${commandText}"`);
    return `echo "Unknown command: ${commandText}"`;
}

/**
 * Execute Command with File Operations Support
 * @param {string} commandText - The voice command received from frontend
 * @returns {Promise<Object>} - Execution result with action, result, and success status
 */
async function executeCommand(commandText) {
    console.log(`Executing command: "${commandText}"`);
    
    // Parse the command
    const parseResult = commandParser.parseCommand(commandText);
    
    if (parseResult.type === "error") {
        return {
            input: commandText,
            action: "Parse Error",
            result: parseResult.error,
            success: false
        };
    }
    
    if (parseResult.type === "memoryOp") {
        // Handle memory operations
        try {
            const result = await executeMemoryOperation(parseResult.fn, parseResult.args);
            
            // Add command to history
            await memory.addCommandToHistory(commandText, result);
            
            return {
                input: commandText,
                action: result.action,
                result: result.result,
                success: result.success
            };
        } catch (error) {
            return {
                input: commandText,
                action: "Memory Operation Error",
                result: `Error executing memory operation: ${error.message}`,
                success: false
            };
        }
    }
    
    if (parseResult.type === "fileOp") {
        // Handle file operations
        try {
            const fileOps = new FileOperations(WORKING_DIR);
            const result = await fileOps[parseResult.fn](...parseResult.args);
            
            // Add command to history
            await memory.addCommandToHistory(commandText, result);
            
            return {
                input: commandText,
                action: result.action,
                result: result.result,
                success: result.success
            };
        } catch (error) {
            return {
                input: commandText,
                action: "File Operation Error",
                result: `Error executing file operation: ${error.message}`,
                success: false
            };
        }
    }
    
    if (parseResult.type === "shell") {
        // Handle shell commands
        try {
            const result = await executeShellCommand(parseResult.command);
            
            // Add command to history
            await memory.addCommandToHistory(commandText, result);
            
            return {
                input: commandText,
                action: "Shell Command",
                result: result.output,
                success: result.success
            };
        } catch (error) {
            return {
                input: commandText,
                action: "Shell Command Error",
                result: `Error executing shell command: ${error.message}`,
                success: false
            };
        }
    }
    
    // Fallback
    return {
        input: commandText,
        action: "Unknown Command",
        result: "Command type not recognized",
        success: false
    };
}

/**
 * Execute Memory Operation
 * @param {string} operation - Memory operation to execute
 * @param {Array} args - Arguments for the operation
 * @returns {Promise<Object>} - Execution result
 */
async function executeMemoryOperation(operation, args) {
    try {
        let result;
        
        switch (operation) {
            case 'saveMemory':
                result = await memory.saveMemory(args[0], args[1]);
                return {
                    action: "Save Memory",
                    result: result.message,
                    success: result.status === "success"
                };
                
            case 'getMemory':
                const memoryItem = await memory.getMemory(args[0]);
                if (memoryItem.found) {
                    return {
                        action: "Recall Memory",
                        result: `"${args[0]}" = "${memoryItem.value}" (saved: ${new Date(memoryItem.timestamp).toLocaleString()})`,
                        success: true
                    };
                } else {
                    return {
                        action: "Recall Memory",
                        result: memoryItem.message,
                        success: false
                    };
                }
                
            case 'getAllMemory':
                const allMemory = await memory.getAllMemory();
                const memoryList = Object.entries(allMemory.userData)
                    .map(([key, item]) => `"${key}" = "${item.value}"`)
                    .join('\n');
                return {
                    action: "Show Memory",
                    result: `Memory contains ${allMemory.totalItems} items:\n${memoryList || 'No memories stored'}`,
                    success: true
                };
                
            case 'clearMemory':
                result = await memory.clearMemory();
                return {
                    action: "Clear Memory",
                    result: result.message,
                    success: result.status === "success"
                };
                
            case 'searchMemory':
                const searchResults = await memory.searchMemory(args[0]);
                if (searchResults.count > 0) {
                    const results = searchResults.results
                        .map(item => `"${item.key}" = "${item.value}" (${item.type})`)
                        .join('\n');
                    return {
                        action: "Search Memory",
                        result: `Found ${searchResults.count} matches for "${args[0]}":\n${results}`,
                        success: true
                    };
                } else {
                    return {
                        action: "Search Memory",
                        result: `No matches found for "${args[0]}"`,
                        success: false
                    };
                }
                
            case 'getMemoryStats':
                const stats = await memory.getMemoryStats();
                return {
                    action: "Memory Stats",
                    result: `Memory Statistics:\n- User Data: ${stats.totalUserData} items\n- Context: ${stats.totalContext} items\n- Commands: ${stats.totalCommands} items\n- Last Updated: ${new Date(stats.lastUpdated).toLocaleString()}\n- Memory Size: ${Math.round(stats.memorySize / 1024)} KB`,
                    success: true
                };
                
            case 'getCommandHistory':
                const history = await memory.getCommandHistory();
                if (history.length > 0) {
                    const historyList = history
                        .map((item, index) => `${index + 1}. "${item.command}" (${new Date(item.timestamp).toLocaleString()})`)
                        .join('\n');
                    return {
                        action: "Command History",
                        result: `Recent Commands:\n${historyList}`,
                        success: true
                    };
                } else {
                    return {
                        action: "Command History",
                        result: "No command history available",
                        success: false
                    };
                }
                
            default:
                return {
                    action: "Memory Operation",
                    result: `Unknown memory operation: ${operation}`,
                    success: false
                };
        }
    } catch (error) {
        return {
            action: "Memory Operation",
            result: `Error executing memory operation: ${error.message}`,
            success: false
        };
    }
}

/**
 * Execute Shell Command
 * @param {string} command - Shell command to execute
 * @returns {Promise<Object>} - Execution result
 */
async function executeShellCommand(command) {
    return new Promise((resolve) => {
        // Security check using the security module
        const securityCheck = security.isCommandSafe(command);
        
        if (!securityCheck.safe) {
            // Log the blocked command
            security.logCommand(command, 'BLOCKED', securityCheck.reason);
            
            resolve({
                success: false,
                output: `🚫 Command blocked for security: ${command}\nReason: ${securityCheck.reason}${securityCheck.suggestion ? `\nSuggestion: ${securityCheck.suggestion}` : ''}`,
                blocked: true
            });
            return;
        }
        
        // Log the allowed command
        security.logCommand(command, 'ALLOWED', 'Command passed security checks');
        
        // Execute the command
        exec(command, { 
            cwd: WORKING_DIR,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                console.log(`Command execution error: ${error.message}`);
                security.logCommand(command, 'ERROR', error.message);
                resolve({
                    success: false,
                    output: stderr || error.message,
                    blocked: false
                });
            } else {
                console.log(`Command executed successfully in ${WORKING_DIR}`);
                security.logCommand(command, 'SUCCESS', 'Command executed successfully');
                resolve({
                    success: true,
                    output: stdout || 'Command executed successfully',
                    blocked: false
                });
            }
        });
    });
}

/**
 * Log Command
 * @param {string} commandText - The original voice command
 * @param {string} mappedCommand - The mapped Linux command
 * @param {string} output - Command execution output
 * @param {string|null} error - Error message if any
 */
function logCommand(commandText, mappedCommand, output, error) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            receivedCommand: commandText,
            mappedCommand: mappedCommand,
            output: output,
            error: error
        };
        
        const logsDir = path.join(__dirname, '..', 'logs');
        const logFile = path.join(logsDir, 'commandHistory.json');
        
        // Ensure logs directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Read existing logs
        let logs = [];
        if (fs.existsSync(logFile)) {
            try {
                const data = fs.readFileSync(logFile, 'utf8');
                logs = JSON.parse(data);
            } catch (parseError) {
                console.log('Warning: Could not parse existing logs, starting fresh');
                logs = [];
            }
        }
        
        // Append new log entry
        logs.push(logEntry);
        
        // Write back to file
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        
        console.log(`Command logged: ${commandText} -> ${mappedCommand}`);
        
    } catch (logError) {
        console.error('Error logging command:', logError.message);
    }
}

module.exports = {
    mapCommandToShell,
    executeCommand,
    logCommand
};
