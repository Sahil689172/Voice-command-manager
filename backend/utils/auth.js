// Authentication Utility
// Handles user registration, authentication, and JWT token management

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// JWT secret (in production, this should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'voice-cmd-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Ensure data directory exists
async function ensureDataDirectory() {
    try {
        await fsPromises.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create data directory:', error.message);
    }
}

// Load users from file
async function loadUsers() {
    try {
        await ensureDataDirectory();
        
        if (!fs.existsSync(USERS_FILE)) {
            return {};
        }
        
        const data = await fsPromises.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error.message);
        return {};
    }
}

// Save users to file
async function saveUsers(users) {
    try {
        await ensureDataDirectory();
        await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving users:', error.message);
    }
}

// Register a new user
async function registerUser(username, password) {
    try {
        // Validate input
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password are required',
                code: 'E_MISSING_CREDENTIALS'
            };
        }
        
        if (username.length < 3) {
            return {
                success: false,
                message: 'Username must be at least 3 characters long',
                code: 'E_INVALID_USERNAME'
            };
        }
        
        if (password.length < 6) {
            return {
                success: false,
                message: 'Password must be at least 6 characters long',
                code: 'E_INVALID_PASSWORD'
            };
        }
        
        // Load existing users
        const users = await loadUsers();
        
        // Check if user already exists
        if (users[username]) {
            return {
                success: false,
                message: 'Username already exists',
                code: 'E_USER_EXISTS'
            };
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create user object
        const user = {
            username,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };
        
        // Save user
        users[username] = user;
        await saveUsers(users);
        
        console.log(`User registered: ${username}`);
        
        return {
            success: true,
            message: 'User registered successfully',
            user: {
                username: user.username,
                createdAt: user.createdAt
            }
        };
        
    } catch (error) {
        console.error('Error registering user:', error);
        return {
            success: false,
            message: `Registration failed: ${error.message}`,
            code: 'E_REGISTRATION_FAILED'
        };
    }
}

// Authenticate user
async function authenticateUser(username, password) {
    try {
        // Validate input
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password are required',
                code: 'E_MISSING_CREDENTIALS'
            };
        }
        
        // Load users
        const users = await loadUsers();
        const user = users[username];
        
        if (!user) {
            return {
                success: false,
                message: 'Invalid username or password',
                code: 'E_INVALID_CREDENTIALS'
            };
        }
        
        if (!user.isActive) {
            return {
                success: false,
                message: 'Account is deactivated',
                code: 'E_ACCOUNT_DEACTIVATED'
            };
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return {
                success: false,
                message: 'Invalid username or password',
                code: 'E_INVALID_CREDENTIALS'
            };
        }
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        await saveUsers(users);
        
        console.log(`User authenticated: ${username}`);
        
        return {
            success: true,
            message: 'Authentication successful',
            user: {
                username: user.username,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        };
        
    } catch (error) {
        console.error('Error authenticating user:', error);
        return {
            success: false,
            message: `Authentication failed: ${error.message}`,
            code: 'E_AUTHENTICATION_FAILED'
        };
    }
}

// Issue JWT token
function issueToken(user) {
    try {
        const payload = {
            username: user.username,
            createdAt: user.createdAt,
            iat: Math.floor(Date.now() / 1000)
        };
        
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
        return {
            success: true,
            token: token,
            expiresIn: JWT_EXPIRES_IN
        };
        
    } catch (error) {
        console.error('Error issuing token:', error);
        return {
            success: false,
            message: `Token generation failed: ${error.message}`,
            code: 'E_TOKEN_GENERATION_FAILED'
        };
    }
}

// Verify JWT token
function verifyToken(token) {
    try {
        if (!token) {
            return {
                success: false,
                message: 'No token provided',
                code: 'E_NO_TOKEN'
            };
        }
        
        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace('Bearer ', '');
        
        const decoded = jwt.verify(cleanToken, JWT_SECRET);
        
        return {
            success: true,
            user: {
                username: decoded.username,
                createdAt: decoded.createdAt
            }
        };
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return {
                success: false,
                message: 'Token has expired',
                code: 'E_TOKEN_EXPIRED'
            };
        } else if (error.name === 'JsonWebTokenError') {
            return {
                success: false,
                message: 'Invalid token',
                code: 'E_INVALID_TOKEN'
            };
        } else {
            return {
                success: false,
                message: `Token verification failed: ${error.message}`,
                code: 'E_TOKEN_VERIFICATION_FAILED'
            };
        }
    }
}

// Get user info from token
async function getUserInfo(token) {
    try {
        const verification = verifyToken(token);
        
        if (!verification.success) {
            return verification;
        }
        
        // Load user details
        const users = await loadUsers();
        const user = users[verification.user.username];
        
        if (!user) {
            return {
                success: false,
                message: 'User not found',
                code: 'E_USER_NOT_FOUND'
            };
        }
        
        return {
            success: true,
            user: {
                username: user.username,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                isActive: user.isActive
            }
        };
        
    } catch (error) {
        console.error('Error getting user info:', error);
        return {
            success: false,
            message: `Failed to get user info: ${error.message}`,
            code: 'E_GET_USER_INFO_FAILED'
        };
    }
}

// Middleware to protect routes
function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                status: "error",
                message: "Authorization header required",
                code: "E_NO_AUTH_HEADER",
                data: {
                    authenticated: false
                }
            });
        }
        
        const verification = verifyToken(authHeader);
        
        if (!verification.success) {
            return res.status(401).json({
                status: "error",
                message: verification.message,
                code: verification.code,
                data: {
                    authenticated: false
                }
            });
        }
        
        // Add user info to request
        req.user = verification.user;
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            status: "error",
            message: "Authentication middleware error",
            code: "E_AUTH_MIDDLEWARE_ERROR",
            data: {
                authenticated: false
            }
        });
    }
}

// Get user-specific data directory
function getUserDataDir(username) {
    return path.join(DATA_DIR, 'users', username);
}

// Ensure user data directory exists
async function ensureUserDataDir(username) {
    try {
        const userDir = getUserDataDir(username);
        await fsPromises.mkdir(userDir, { recursive: true });
        return userDir;
    } catch (error) {
        console.error('Failed to create user data directory:', error.message);
        throw error;
    }
}

// Get user-specific file path
function getUserFilePath(username, filename) {
    return path.join(getUserDataDir(username), filename);
}

// Get user-specific memory file
function getUserMemoryFile(username) {
    return getUserFilePath(username, 'memory.json');
}

// Get user-specific command history file
function getUserCommandHistoryFile(username) {
    return getUserFilePath(username, 'commandHistory.json');
}

// Get user-specific schedules file
function getUserSchedulesFile(username) {
    return getUserFilePath(username, 'scheduledJobs.json');
}

// Get user-specific logs directory
function getUserLogsDir(username) {
    return path.join(getUserDataDir(username), 'logs');
}

// Get user-specific command log file
function getUserCommandLogFile(username) {
    return path.join(getUserLogsDir(username), 'commands.log');
}

// Get user-specific security log file
function getUserSecurityLogFile(username) {
    return path.join(getUserLogsDir(username), 'security.log');
}

module.exports = {
    registerUser,
    authenticateUser,
    issueToken,
    verifyToken,
    getUserInfo,
    requireAuth,
    getUserDataDir,
    ensureUserDataDir,
    getUserFilePath,
    getUserMemoryFile,
    getUserCommandHistoryFile,
    getUserSchedulesFile,
    getUserLogsDir,
    getUserCommandLogFile,
    getUserSecurityLogFile,
    USERS_FILE
};
