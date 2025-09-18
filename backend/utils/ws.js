// WebSocket Utility
// Handles real-time communication between backend and frontend

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'voice-cmd-secret-key-change-in-production';

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // Map of userId -> Set of WebSocket connections
        this.connectionCount = 0;
    }

    // Initialize WebSocket server
    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        console.log('WebSocket server initialized on /ws');
    }

    // Handle new WebSocket connection
    handleConnection(ws, req) {
        this.connectionCount++;
        const connectionId = this.connectionCount;
        
        console.log(`New WebSocket connection: ${connectionId}`);

        // Set up connection metadata
        ws.connectionId = connectionId;
        ws.isAlive = true;
        ws.userId = null;

        // Handle authentication
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'authenticate' && data.token) {
                    this.authenticateConnection(ws, data.token);
                } else if (data.type === 'ping') {
                    this.handlePing(ws);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                this.sendError(ws, 'Invalid message format');
            }
        });

        // Handle connection close
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });

        // Handle connection errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for connection ${connectionId}:`, error);
            this.handleDisconnect(ws);
        });

        // Set up ping/pong for connection health
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Send initial connection message
        this.sendMessage(ws, {
            type: 'connection',
            message: 'Connected to Voice Command Manager',
            connectionId: connectionId,
            authenticated: false
        });
    }

    // Authenticate WebSocket connection
    authenticateConnection(ws, token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            ws.userId = decoded.username;
            ws.authenticated = true;

            // Add to user's client set
            if (!this.clients.has(ws.userId)) {
                this.clients.set(ws.userId, new Set());
            }
            this.clients.get(ws.userId).add(ws);

            console.log(`WebSocket authenticated for user: ${ws.userId}`);

            this.sendMessage(ws, {
                type: 'authenticated',
                message: `Authenticated as ${ws.userId}`,
                userId: ws.userId
            });

        } catch (error) {
            console.error('WebSocket authentication failed:', error);
            this.sendError(ws, 'Authentication failed');
        }
    }

    // Handle ping message
    handlePing(ws) {
        this.sendMessage(ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
        });
    }

    // Handle connection disconnect
    handleDisconnect(ws) {
        console.log(`WebSocket disconnected: ${ws.connectionId}`);
        
        if (ws.userId && this.clients.has(ws.userId)) {
            this.clients.get(ws.userId).delete(ws);
            if (this.clients.get(ws.userId).size === 0) {
                this.clients.delete(ws.userId);
            }
        }
    }

    // Send message to specific WebSocket
    sendMessage(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        }
    }

    // Send error message
    sendError(ws, message) {
        this.sendMessage(ws, {
            type: 'error',
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    // Broadcast to all authenticated clients
    broadcast(data) {
        this.wss.clients.forEach((ws) => {
            if (ws.authenticated && ws.readyState === WebSocket.OPEN) {
                this.sendMessage(ws, data);
            }
        });
    }

    // Broadcast to specific user
    broadcastToUser(userId, data) {
        if (this.clients.has(userId)) {
            this.clients.get(userId).forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendMessage(ws, data);
                }
            });
        }
    }

    // Broadcast command executed event
    broadcastCommandExecuted(userId, command, result, status) {
        this.broadcastToUser(userId, {
            type: 'commandExecuted',
            data: {
                command: command,
                result: result,
                status: status,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast security event
    broadcastSecurityEvent(userId, action, detail) {
        this.broadcastToUser(userId, {
            type: 'securityEvent',
            data: {
                action: action,
                detail: detail,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast memory updated event
    broadcastMemoryUpdated(userId, key, value) {
        this.broadcastToUser(userId, {
            type: 'memoryUpdated',
            data: {
                key: key,
                value: value,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast schedule triggered event
    broadcastScheduleTriggered(userId, scheduleId, command, result) {
        this.broadcastToUser(userId, {
            type: 'scheduleTriggered',
            data: {
                scheduleId: scheduleId,
                command: command,
                result: result,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast log event
    broadcastLogEvent(userId, level, message, data = {}) {
        this.broadcastToUser(userId, {
            type: 'logEvent',
            data: {
                level: level,
                message: message,
                data: data,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast history updated event
    broadcastHistoryUpdated(userId, action, commandData) {
        this.broadcastToUser(userId, {
            type: 'historyUpdated',
            data: {
                action: action, // 'added', 'cleared', 'reexecuted'
                command: commandData,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Broadcast system status
    broadcastSystemStatus(status, message) {
        this.broadcast({
            type: 'systemStatus',
            data: {
                status: status,
                message: message,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Get connection statistics
    getStats() {
        return {
            totalConnections: this.connectionCount,
            activeConnections: this.wss.clients.size,
            authenticatedUsers: this.clients.size,
            users: Array.from(this.clients.keys())
        };
    }

    // Start ping/pong interval for connection health
    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log(`Terminating dead connection: ${ws.connectionId}`);
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // Ping every 30 seconds
    }

    // Cleanup
    close() {
        if (this.wss) {
            this.wss.close();
        }
    }
}

// Create singleton instance
const wsManager = new WebSocketManager();

module.exports = wsManager;
