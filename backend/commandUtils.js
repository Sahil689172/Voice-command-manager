// VOICE-CMD Command Utilities
// This module will handle command parsing and execution for the voice-controlled Linux manager

// Import required modules for command execution
const { exec } = require('child_process');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const os = require('os');

// VOICE-CMD working directory - same as server
const WORKING_DIR = path.join(os.homedir(), 'Desktop', 'VOICE-CMD');

/**
 * Parse Command
 * This function will parse natural language voice commands into Linux shell commands
 * 
 * @param {string} commandText - The voice command received from frontend
 * @returns {string} - Placeholder response for now
 */
function parseCommand(commandText) {
    // TODO: Implement voice command parsing logic
    // This will convert natural language to structured command objects
    
    console.log(`Received command: "${commandText}"`);
    
    // TODO: Add command validation and sanitization here
    // TODO: Add natural language processing to extract intent and parameters
    // TODO: Map natural language to Linux commands
    
    // Placeholder return - will be implemented later
    return "Command received successfully";
}

/**
 * Map Command to Shell
 * This function maps natural language voice commands to Linux shell commands
 * 
 * @param {string} commandText - The voice command received from frontend
 * @returns {string} - Mapped Linux shell command
 */
function mapCommandToShell(commandText) {
    console.log(`Mapping command: "${commandText}"`);
    
    // Convert to lowercase for easier matching
    const command = commandText.toLowerCase().trim();
    
    // TODO: Add more sophisticated natural language processing here
    // TODO: Add parameter extraction and validation
    // TODO: Add command sanitization for security
    
    // Map common voice commands to Linux commands
    if (command.includes('create directory') || command.includes('create a directory')) {
        // Extract directory name from command
        const match = command.match(/create\s+(?:a\s+)?directory\s+(.+)/);
        const dirName = match ? match[1].trim() : 'new_directory';
        return `mkdir ${dirName}`;
    }
    
    if (command.includes('create file') || command.includes('create a file')) {
        // Extract file name from command
        const match = command.match(/create\s+(?:a\s+)?file\s+(.+)/);
        const fileName = match ? match[1].trim() : 'new_file.txt';
        return `touch ${fileName}`;
    }
    
    if (command.includes('delete file') || command.includes('remove file')) {
        // Extract file name from command
        const match = command.match(/(?:delete|remove)\s+file\s+(.+)/);
        const fileName = match ? match[1].trim() : 'file_to_delete';
        return `rm ${fileName}`;
    }
    
    if (command.includes('move file') || command.includes('move')) {
        // Extract source and destination from command
        const match = command.match(/move\s+(?:file\s+)?(.+?)\s+to\s+(.+)/);
        if (match) {
            const source = match[1].trim();
            const destination = match[2].trim();
            return `mv ${source} ${destination}`;
        }
        return 'mv source_file destination_file';
    }
    
    if (command.includes('copy file') || command.includes('copy')) {
        // Extract source and destination from command
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
        // Extract process ID from command
        const match = command.match(/kill\s+process\s+(\d+)/);
        const pid = match ? match[1] : 'PID';
        return `kill ${pid}`;
    }
    
    if (command.includes('open nano') || command.includes('nano')) {
        // Extract file name from command
        const match = command.match(/open\s+nano\s+(.+)/);
        const fileName = match ? match[1].trim() : 'filename.txt';
        return `nano ${fileName}`;
    }
    
    if (command.includes('save file')) {
        // TODO: Implement nano save keystrokes (Ctrl+O, Enter, Ctrl+X)
        // For now, return a placeholder
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
 * Execute Command
 * This function safely executes Linux commands with whitelist security
 * 
 * @param {string} mappedCommand - The mapped Linux command to execute
 * @returns {Promise<Object>} - Execution result with output and status
 */
async function executeCommand(mappedCommand) {
    console.log(`Executing command: "${mappedCommand}"`);
    
    // TODO: Add more sophisticated security validation
    // TODO: Add command timeout handling
    // TODO: Add input sanitization for parameters
    // TODO: Add command logging for audit trail
    // TODO: Add TTS response generation for command results
    
    // Whitelist of allowed commands for security
    const allowedCommands = [
        'mkdir', 'touch', 'rm', 'mv', 'cp', 'ls', 'ps', 'kill', 'nano', 'echo'
    ];
    
    // Extract the base command (first word) from the mapped command
    const baseCommand = mappedCommand.split(' ')[0];
    
    // Check if command is in whitelist
    if (!allowedCommands.includes(baseCommand)) {
        console.log(`Command not in whitelist: ${baseCommand}`);
        return {
            success: false,
            output: `Error: Command '${baseCommand}' is not allowed for security reasons`,
            error: 'Command not whitelisted'
        };
    }
    
    // TODO: Add parameter validation for specific commands
    // TODO: Add path validation to prevent directory traversal
    // TODO: Add size limits for file operations
    // TODO: Add nano keystroke handling for interactive commands
    
    return new Promise((resolve) => {
        // Use exec for simple commands (most of our whitelisted commands)
        // Set working directory to VOICE-CMD directory
        exec(mappedCommand, { 
            cwd: WORKING_DIR, // Set working directory to ~/Desktop/VOICE-CMD
            timeout: 10000, // 10 second timeout
            maxBuffer: 1024 * 1024 // 1MB buffer limit
        }, (error, stdout, stderr) => {
            if (error) {
                console.log(`Command execution error: ${error.message}`);
                resolve({
                    success: false,
                    output: stderr || error.message,
                    error: error.message
                });
            } else {
                console.log(`Command executed successfully in ${WORKING_DIR}`);
                resolve({
                    success: true,
                    output: stdout || 'Command executed successfully',
                    error: null
                });
            }
        });
    });
}

/**
 * Command Parser (Legacy function - keeping for future use)
 * This function will parse natural language voice commands into Linux shell commands
 * 
 * @param {string} voiceCommand - The voice command received from frontend
 * @returns {Object} - Parsed command object with type, action, and parameters
 */
function parseVoiceCommand(voiceCommand) {
    // TODO: Implement voice command parsing logic
    // This will convert natural language to structured command objects
    
    console.log(`Parsing voice command: "${voiceCommand}"`);
    
    // Placeholder return - will be implemented later
    return {
        type: 'placeholder',
        action: 'parse',
        originalCommand: voiceCommand,
        parsedAt: new Date().toISOString()
    };
}

/**
 * Command Executor (Legacy function - keeping for future use)
 * This function will safely execute Linux commands based on parsed command objects
 * 
 * @param {Object} parsedCommand - The parsed command object
 * @returns {Promise<Object>} - Execution result with success status and output
 */
async function executeCommandLegacy(parsedCommand) {
    // TODO: Implement command execution logic
    // This will safely execute Linux commands using node-pty or child_process
    
    // Security considerations:
    // - Whitelist allowed commands to prevent dangerous operations
    // - Validate all parameters before execution
    // - Use proper error handling and timeouts
    // - Log all command executions for security auditing
    
    console.log(`Executing command:`, parsedCommand);
    
    // Placeholder return - will be implemented later
    return {
        success: true,
        output: 'Command execution placeholder - not implemented yet',
        error: null,
        executedAt: new Date().toISOString(),
        command: parsedCommand
    };
}

/**
 * File Operations
 * These functions will handle file system operations
 */
const fileOperations = {
    // TODO: Implement file creation
    create: async (filePath, content = '') => {
        console.log(`Creating file: ${filePath}`);
        // Implementation will go here
    },
    
    // TODO: Implement file deletion
    delete: async (filePath) => {
        console.log(`Deleting file: ${filePath}`);
        // Implementation will go here
    },
    
    // TODO: Implement file copying
    copy: async (source, destination) => {
        console.log(`Copying file: ${source} -> ${destination}`);
        // Implementation will go here
    },
    
    // TODO: Implement file moving
    move: async (source, destination) => {
        console.log(`Moving file: ${source} -> ${destination}`);
        // Implementation will go here
    },
    
    // TODO: Implement directory listing
    list: async (directory = '.') => {
        console.log(`Listing directory: ${directory}`);
        // Implementation will go here
    }
};

/**
 * Process Operations
 * These functions will handle process management
 */
const processOperations = {
    // TODO: Implement process listing
    list: async () => {
        console.log('Listing running processes');
        // Implementation will go here
    },
    
    // TODO: Implement process killing
    kill: async (pid) => {
        console.log(`Killing process: ${pid}`);
        // Implementation will go here
    }
};

/**
 * Editor Operations
 * These functions will handle nano editor operations
 */
const editorOperations = {
    // TODO: Implement nano editor opening
    open: async (filePath) => {
        console.log(`Opening nano editor with file: ${filePath}`);
        // Implementation will go here
    },
    
    // TODO: Implement nano editor saving
    save: async () => {
        console.log('Saving nano editor content');
        // Implementation will go here
    },
    
    // TODO: Implement nano editor closing
    close: async () => {
        console.log('Closing nano editor');
        // Implementation will go here
    }
};

/**
 * Security and Validation
 * These functions will ensure safe command execution
 */
const security = {
    // TODO: Implement command whitelist validation
    isCommandAllowed: (command) => {
        console.log(`Validating command: ${command}`);
        // Implementation will go here
        return true; // Placeholder
    },
    
    // TODO: Implement parameter sanitization
    sanitizeParameters: (params) => {
        console.log('Sanitizing parameters:', params);
        // Implementation will go here
        return params; // Placeholder
    }
};

/**
 * Log Command
 * This function logs executed commands to commandHistory.json for debugging and history
 * 
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
        
        const logsDir = path.join(__dirname, 'logs');
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
        // Don't throw error - logging failure shouldn't break command execution
    }
}

// Export all functions and objects
module.exports = {
    parseCommand,
    mapCommandToShell,
    executeCommand,
    logCommand,
    parseVoiceCommand,
    fileOperations,
    processOperations,
    editorOperations,
    security
};
