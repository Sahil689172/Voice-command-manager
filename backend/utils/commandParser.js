// VOICE-CMD Command Parser
// Parses natural language commands and routes to file operations or shell commands

/**
 * Parse natural language command
 * @param {string} input - Natural language command input
 * @returns {Object} - Parsed command with type and parameters
 */
function parseCommand(input) {
    if (!input || typeof input !== 'string') {
        return {
            type: "error",
            error: "Invalid input: command must be a non-empty string"
        };
    }

    const trimmedInput = input.trim().toLowerCase();
    
    // Memory operation patterns
    const memoryOpPatterns = [
        {
            regex: /remember\s+(.+?)\s+is\s+(.+)/i,
            type: "memoryOp",
            fn: "saveMemory",
            args: (match) => [match[1].trim(), match[2].trim()]
        },
        {
            regex: /remember\s+(.+)/i,
            type: "memoryOp",
            fn: "saveMemory",
            args: (match) => [match[1].trim(), "true"]
        },
        {
            regex: /recall\s+(.+)/i,
            type: "memoryOp",
            fn: "getMemory",
            args: (match) => [match[1].trim()]
        },
        {
            regex: /show\s+memory/i,
            type: "memoryOp",
            fn: "getAllMemory",
            args: () => []
        },
        {
            regex: /clear\s+memory/i,
            type: "memoryOp",
            fn: "clearMemory",
            args: () => []
        },
        {
            regex: /search\s+memory\s+(.+)/i,
            type: "memoryOp",
            fn: "searchMemory",
            args: (match) => [match[1].trim()]
        },
        {
            regex: /memory\s+stats/i,
            type: "memoryOp",
            fn: "getMemoryStats",
            args: () => []
        },
        {
            regex: /command\s+history/i,
            type: "memoryOp",
            fn: "getCommandHistory",
            args: () => []
        }
    ];

    // File operation patterns
    const fileOpPatterns = [
        {
            regex: /create\s+file\s+(\S+)/i,
            type: "fileOp",
            fn: "createFile",
            args: (match) => [match[1]]
        },
        {
            regex: /create\s+a\s+file\s+(\S+)/i,
            type: "fileOp",
            fn: "createFile",
            args: (match) => [match[1]]
        },
        {
            regex: /create\s+directory\s+(\S+)/i,
            type: "fileOp",
            fn: "createDirectory",
            args: (match) => [match[1]]
        },
        {
            regex: /create\s+a\s+directory\s+(\S+)/i,
            type: "fileOp",
            fn: "createDirectory",
            args: (match) => [match[1]]
        },
        {
            regex: /make\s+directory\s+(\S+)/i,
            type: "fileOp",
            fn: "createDirectory",
            args: (match) => [match[1]]
        },
        {
            regex: /mkdir\s+(\S+)/i,
            type: "fileOp",
            fn: "createDirectory",
            args: (match) => [match[1]]
        },
        {
            regex: /delete\s+file\s+(\S+)/i,
            type: "fileOp",
            fn: "deleteFile",
            args: (match) => [match[1]]
        },
        {
            regex: /copy\s+file\s+(\S+)\s+to\s+(\S+)/i,
            type: "fileOp",
            fn: "copyFile",
            args: (match) => [match[1], match[2]]
        },
        {
            regex: /move\s+file\s+(\S+)\s+to\s+(\S+)/i,
            type: "fileOp",
            fn: "moveFile",
            args: (match) => [match[1], match[2]]
        },
        {
            regex: /list\s+files/i,
            type: "fileOp",
            fn: "listFiles",
            args: () => []
        }
    ];

    // Check for memory operation patterns first
    for (const pattern of memoryOpPatterns) {
        const match = input.match(pattern.regex);
        if (match) {
            return {
                type: pattern.type,
                fn: pattern.fn,
                args: pattern.args(match),
                originalInput: input
            };
        }
    }

    // Check for file operation patterns
    for (const pattern of fileOpPatterns) {
        const match = input.match(pattern.regex);
        if (match) {
            return {
                type: pattern.type,
                fn: pattern.fn,
                args: pattern.args(match),
                originalInput: input
            };
        }
    }

    // Check for direct shell commands
    const shellCommands = [
        'ls', 'pwd', 'cd', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'ps', 'kill', 
        'nano', 'cat', 'grep', 'find', 'which', 'whoami', 'uname', 'df', 
        'free', 'uptime', 'ping', 'curl', 'wget'
    ];

    const firstWord = trimmedInput.split(' ')[0];
    if (shellCommands.includes(firstWord)) {
        return {
            type: "shell",
            command: input,
            originalInput: input
        };
    }

    // No pattern matched - treat as shell command
    return {
        type: "shell",
        command: input,
        originalInput: input
    };
}

/**
 * Execute file operation
 * @param {string} operation - Operation name
 * @param {Array} args - Operation arguments
 * @param {string} workingDir - Working directory
 * @returns {Object} - Operation result
 */
async function executeFileOperation(operation, args, workingDir) {
    const FileOperations = require('./fileOps');
    const fileOps = new FileOperations(workingDir);
    
    switch (operation) {
        case 'createFile':
            return await fileOps.createFile(args[0]);
        case 'createDirectory':
            return await fileOps.createDirectory(args[0]);
        case 'deleteFile':
            return await fileOps.deleteFile(args[0]);
        case 'copyFile':
            return await fileOps.copyFile(args[0], args[1]);
        case 'moveFile':
            return await fileOps.moveFile(args[0], args[1]);
        case 'listFiles':
            return await fileOps.listFiles(args[0] || '.');
        default:
            return {
                action: "File Operation",
                result: `Unknown file operation: ${operation} ❌`,
                success: false
            };
    }
}

module.exports = {
    parseCommand,
    executeFileOperation
};
