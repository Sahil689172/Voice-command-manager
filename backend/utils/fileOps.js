// VOICE-CMD File Operations Module
// Safe file operations using Node.js fs/promises API

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

/**
 * File Operations Class
 * Handles all file system operations with proper error handling
 */
class FileOperations {
    constructor(workingDir) {
        this.workingDir = workingDir || path.join(os.homedir(), 'Desktop', 'VOICE-CMD');
    }

    /**
     * Create a directory
     * @param {string} dirname - Name of the directory to create
     * @returns {Object} - Result object with action, result, and success status
     */
    async createDirectory(dirname) {
        try {
            const dirPath = path.resolve(this.workingDir, dirname);
            
            // Check if directory already exists
            try {
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory()) {
                    return {
                        action: "Create Directory",
                        result: `Directory '${dirname}' already exists ❌`,
                        success: false,
                        dirname: dirname,
                        dirPath: dirPath
                    };
                }
            } catch (error) {
                // Directory doesn't exist, proceed with creation
            }

            // Create the directory
            await fs.mkdir(dirPath, { recursive: true });
            
            return {
                action: "Create Directory",
                result: `Directory '${dirname}' created successfully ✅`,
                success: true,
                dirname: dirname,
                dirPath: dirPath
            };
        } catch (error) {
            return {
                action: "Create Directory",
                result: `Failed to create directory '${dirname}': ${error.message} ❌`,
                success: false,
                error: error.message,
                dirname: dirname
            };
        }
    }

    /**
     * Create an empty file
     * @param {string} filename - Name of the file to create
     * @returns {Object} - Result object with action, result, and success status
     */
    async createFile(filename) {
        try {
            const filePath = path.resolve(this.workingDir, filename);
            
            // Check if file already exists
            try {
                await fs.access(filePath);
                return {
                    action: "Create File",
                    result: `File '${filename}' already exists ❌`,
                    success: false,
                    filename: filename,
                    filePath: filePath
                };
            } catch (error) {
                // File doesn't exist, proceed with creation
            }

            // Create the file
            await fs.writeFile(filePath, '');
            
            return {
                action: "Create File",
                result: `File '${filename}' created successfully ✅`,
                success: true,
                filename: filename,
                filePath: filePath
            };
        } catch (error) {
            return {
                action: "Create File",
                result: `Error creating file '${filename}': ${error.message} ❌`,
                success: false,
                filename: filename,
                error: error.message
            };
        }
    }

    /**
     * Delete a file
     * @param {string} filename - Name of the file to delete
     * @returns {Object} - Result object with action, result, and success status
     */
    async deleteFile(filename) {
        try {
            const filePath = path.resolve(this.workingDir, filename);
            
            // Check if file exists
            try {
                await fs.access(filePath);
            } catch (error) {
                return {
                    action: "Delete File",
                    result: `File '${filename}' not found ❌`,
                    success: false,
                    filename: filename,
                    filePath: filePath
                };
            }

            // Get file stats to determine if it's a file or directory
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                return {
                    action: "Delete File",
                    result: `'${filename}' is a directory, not a file ❌`,
                    success: false,
                    filename: filename,
                    filePath: filePath
                };
            }

            // Delete the file
            await fs.unlink(filePath);
            
            return {
                action: "Delete File",
                result: `File '${filename}' deleted successfully ✅`,
                success: true,
                filename: filename,
                filePath: filePath
            };
        } catch (error) {
            return {
                action: "Delete File",
                result: `Error deleting file '${filename}': ${error.message} ❌`,
                success: false,
                filename: filename,
                error: error.message
            };
        }
    }

    /**
     * Copy a file
     * @param {string} sourceFilename - Source file name
     * @param {string} destFilename - Destination file name
     * @returns {Object} - Result object with action, result, and success status
     */
    async copyFile(sourceFilename, destFilename) {
        try {
            const sourcePath = path.resolve(this.workingDir, sourceFilename);
            const destPath = path.resolve(this.workingDir, destFilename);
            
            // Check if source file exists
            try {
                await fs.access(sourcePath);
            } catch (error) {
                return {
                    action: "Copy File",
                    result: `Source file '${sourceFilename}' not found ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destFilename: destFilename,
                    sourcePath: sourcePath,
                    destPath: destPath
                };
            }

            // Check if source is a file
            const sourceStats = await fs.stat(sourcePath);
            if (sourceStats.isDirectory()) {
                return {
                    action: "Copy File",
                    result: `'${sourceFilename}' is a directory, not a file ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destFilename: destFilename,
                    sourcePath: sourcePath,
                    destPath: destPath
                };
            }

            // Check if destination already exists
            try {
                await fs.access(destPath);
                return {
                    action: "Copy File",
                    result: `Destination file '${destFilename}' already exists ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destFilename: destFilename,
                    sourcePath: sourcePath,
                    destPath: destPath
                };
            } catch (error) {
                // Destination doesn't exist, proceed with copy
            }

            // Copy the file
            await fs.copyFile(sourcePath, destPath);
            
            return {
                action: "Copy File",
                result: `File '${sourceFilename}' copied to '${destFilename}' successfully ✅`,
                success: true,
                sourceFilename: sourceFilename,
                destFilename: destFilename,
                sourcePath: sourcePath,
                destPath: destPath
            };
        } catch (error) {
            return {
                action: "Copy File",
                result: `Error copying file '${sourceFilename}' to '${destFilename}': ${error.message} ❌`,
                success: false,
                sourceFilename: sourceFilename,
                destFilename: destFilename,
                error: error.message
            };
        }
    }

    /**
     * Move a file
     * @param {string} sourceFilename - Source file name
     * @param {string} destPath - Destination path (can be filename or directory)
     * @returns {Object} - Result object with action, result, and success status
     */
    async moveFile(sourceFilename, destPath) {
        try {
            const sourceFilePath = path.resolve(this.workingDir, sourceFilename);
            let destFilePath;
            
            // Check if source file exists
            try {
                await fs.access(sourceFilePath);
            } catch (error) {
                return {
                    action: "Move File",
                    result: `Source file '${sourceFilename}' not found ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destPath: destPath,
                    sourceFilePath: sourceFilePath
                };
            }

            // Check if source is a file
            const sourceStats = await fs.stat(sourceFilePath);
            if (sourceStats.isDirectory()) {
                return {
                    action: "Move File",
                    result: `'${sourceFilename}' is a directory, not a file ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destPath: destPath,
                    sourceFilePath: sourceFilePath
                };
            }

            // Determine destination path
            if (destPath.endsWith('/') || destPath.endsWith('\\')) {
                // Destination is a directory, keep original filename
                destFilePath = path.resolve(this.workingDir, destPath, sourceFilename);
            } else {
                // Destination is a filename
                destFilePath = path.resolve(this.workingDir, destPath);
            }

            // Check if destination already exists
            try {
                await fs.access(destFilePath);
                return {
                    action: "Move File",
                    result: `Destination '${destPath}' already exists ❌`,
                    success: false,
                    sourceFilename: sourceFilename,
                    destPath: destPath,
                    sourceFilePath: sourceFilePath,
                    destFilePath: destFilePath
                };
            } catch (error) {
                // Destination doesn't exist, proceed with move
            }

            // Ensure destination directory exists
            const destDir = path.dirname(destFilePath);
            try {
                await fs.mkdir(destDir, { recursive: true });
            } catch (error) {
                // Directory might already exist, continue
            }

            // Move the file
            await fs.rename(sourceFilePath, destFilePath);
            
            return {
                action: "Move File",
                result: `File '${sourceFilename}' moved to '${destPath}' successfully ✅`,
                success: true,
                sourceFilename: sourceFilename,
                destPath: destPath,
                sourceFilePath: sourceFilePath,
                destFilePath: destFilePath
            };
        } catch (error) {
            return {
                action: "Move File",
                result: `Error moving file '${sourceFilename}' to '${destPath}': ${error.message} ❌`,
                success: false,
                sourceFilename: sourceFilename,
                destPath: destPath,
                error: error.message
            };
        }
    }

    /**
     * List files in the working directory
     * @param {string} dir - Directory to list (defaults to working directory)
     * @returns {Object} - Result object with action, result, and success status
     */
    async listFiles(dir = ".") {
        try {
            const targetDir = dir === "." ? this.workingDir : path.resolve(this.workingDir, dir);
            
            // Check if directory exists
            try {
                await fs.access(targetDir);
            } catch (error) {
                return {
                    action: "List Files",
                    result: `Directory '${dir}' not found ❌`,
                    success: false,
                    directory: dir,
                    targetDir: targetDir
                };
            }

            // Read directory contents
            const files = await fs.readdir(targetDir, { withFileTypes: true });
            
            // Get detailed information for each file
            const fileList = await Promise.all(
                files.map(async (file) => {
                    const filePath = path.join(targetDir, file.name);
                    const stats = await fs.stat(filePath);
                    
                    return {
                        name: file.name,
                        type: file.isDirectory() ? 'directory' : 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString().split('T')[0]
                    };
                })
            );

            // Sort files: directories first, then files, both alphabetically
            fileList.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            // Format file list for display
            const fileListText = fileList.map(file => {
                const typeIcon = file.type === 'directory' ? '📁' : '📄';
                const size = file.type === 'file' ? ` (${file.size} bytes)` : '';
                return `${typeIcon} ${file.name}${size}`;
            }).join('\n');

            return {
                action: "List Files",
                result: `Found ${fileList.length} items in '${dir}':\n${fileListText}`,
                success: true,
                directory: dir,
                targetDir: targetDir,
                files: fileList,
                totalFiles: fileList.filter(f => f.type === 'file').length,
                totalDirectories: fileList.filter(f => f.type === 'directory').length
            };
        } catch (error) {
            return {
                action: "List Files",
                result: `Error listing files in '${dir}': ${error.message} ❌`,
                success: false,
                directory: dir,
                error: error.message
            };
        }
    }
}

module.exports = FileOperations;
