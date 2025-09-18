// Command Scheduler Utility
// Handles scheduling, managing, and executing automated commands

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const commandUtils = require('./commandUtils');
const logger = require('./logger');
const commandHistory = require('./commandHistory');

const PROJECT_ROOT = path.join(__dirname, '..');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const SCHEDULES_FILE = path.join(LOGS_DIR, 'scheduledJobs.json');

// In-memory storage for active schedules
let activeSchedules = new Map();
let scheduleIdCounter = 1;

// Ensure logs directory exists
async function ensureLogsDirectory() {
    try {
        await fsPromises.mkdir(LOGS_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create logs directory:', error.message);
    }
}

// Load schedules from file
async function loadSchedules() {
    try {
        await ensureLogsDirectory();
        
        if (!fs.existsSync(SCHEDULES_FILE)) {
            return [];
        }
        
        const data = await fsPromises.readFile(SCHEDULES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading schedules:', error.message);
        return [];
    }
}

// Save schedules to file
async function saveSchedules(schedules) {
    try {
        await ensureLogsDirectory();
        await fsPromises.writeFile(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving schedules:', error.message);
    }
}

// Execute a scheduled command
async function executeScheduledCommand(scheduleId, command, isRecurring = false) {
    try {
        console.log(`Executing scheduled command: ${command} (ID: ${scheduleId})`);
        
        // Execute the command
        const result = await commandUtils.executeCommand(command);
        
        // Log the execution
        if (result.success) {
            logger.logCommand(command, 'SUCCESS', `Scheduled command executed successfully`);
        } else if (result.blocked) {
            logger.logCommand(command, 'BLOCKED', `Scheduled command blocked: ${result.result}`);
            logger.logSecurity(command, 'BLOCKED', `Scheduled command blocked: ${result.result}`);
        } else {
            logger.logCommand(command, 'ERROR', `Scheduled command failed: ${result.result}`);
        }
        
        // Add to command history
        const timestamp = new Date().toISOString();
        await commandHistory.addCommand({
            command: command,
            status: result.success ? 'success' : (result.blocked ? 'blocked' : 'error'),
            result: result.result,
            timestamp: timestamp,
            code: result.code || null,
            scheduled: true,
            scheduleId: scheduleId
        });
        
        // If it's not recurring, mark as completed
        if (!isRecurring) {
            await markScheduleCompleted(scheduleId);
        }
        
        return result;
        
    } catch (error) {
        console.error('Error executing scheduled command:', error);
        
        // Log the error
        logger.logCommand(command, 'ERROR', `Scheduled command execution failed: ${error.message}`);
        
        // Add to command history
        const timestamp = new Date().toISOString();
        await commandHistory.addCommand({
            command: command,
            status: 'error',
            result: `Scheduled command execution failed: ${error.message}`,
            timestamp: timestamp,
            code: 'E_SCHEDULED_COMMAND_FAILED',
            scheduled: true,
            scheduleId: scheduleId
        });
        
        return {
            success: false,
            result: `Scheduled command execution failed: ${error.message}`,
            code: 'E_SCHEDULED_COMMAND_FAILED'
        };
    }
}

// Mark a schedule as completed
async function markScheduleCompleted(scheduleId) {
    try {
        const schedules = await loadSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
        
        if (scheduleIndex !== -1) {
            schedules[scheduleIndex].status = 'completed';
            schedules[scheduleIndex].completedAt = new Date().toISOString();
            await saveSchedules(schedules);
            
            // Remove from active schedules
            activeSchedules.delete(scheduleId);
            
            console.log(`Schedule ${scheduleId} marked as completed`);
        }
    } catch (error) {
        console.error('Error marking schedule as completed:', error.message);
    }
}

// Parse time string to Date object
function parseTimeString(timeString) {
    const now = new Date();
    const time = new Date(timeString);
    
    // If the time is in the past, schedule for tomorrow
    if (time <= now) {
        time.setDate(time.getDate() + 1);
    }
    
    return time;
}

// Calculate next execution time for recurring schedules
function calculateNextExecution(schedule) {
    const now = new Date();
    const next = new Date(schedule.nextExecution);
    
    if (schedule.repeat === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (schedule.repeat === 'weekly') {
        next.setDate(next.getDate() + 7);
    } else if (schedule.repeat === 'hourly') {
        next.setHours(next.getHours() + 1);
    }
    
    return next;
}

// Schedule a command
async function scheduleCommand({ command, time, repeat = 'once', description = '' }) {
    try {
        const scheduleId = `schedule_${scheduleIdCounter++}_${Date.now()}`;
        const executionTime = parseTimeString(time);
        
        const schedule = {
            id: scheduleId,
            command: command,
            scheduledTime: time,
            nextExecution: executionTime.toISOString(),
            repeat: repeat,
            status: 'active',
            description: description,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        // Save to file
        const schedules = await loadSchedules();
        schedules.push(schedule);
        await saveSchedules(schedules);
        
        // Schedule the execution
        const delay = executionTime.getTime() - Date.now();
        
        if (repeat === 'once') {
            // One-time execution
            const timeoutId = setTimeout(async () => {
                await executeScheduledCommand(scheduleId, command, false);
            }, delay);
            
            activeSchedules.set(scheduleId, {
                type: 'timeout',
                id: timeoutId,
                schedule: schedule
            });
        } else {
            // Recurring execution
            const intervalId = setInterval(async () => {
                await executeScheduledCommand(scheduleId, command, true);
                
                // Update next execution time
                const nextExecution = calculateNextExecution(schedule);
                schedule.nextExecution = nextExecution.toISOString();
                
                // Update in file
                const schedules = await loadSchedules();
                const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
                if (scheduleIndex !== -1) {
                    schedules[scheduleIndex].nextExecution = nextExecution.toISOString();
                    await saveSchedules(schedules);
                }
            }, delay);
            
            activeSchedules.set(scheduleId, {
                type: 'interval',
                id: intervalId,
                schedule: schedule
            });
        }
        
        console.log(`Scheduled command: ${command} for ${executionTime.toLocaleString()}`);
        
        return {
            success: true,
            scheduleId: scheduleId,
            message: `Command scheduled for ${executionTime.toLocaleString()}`,
            schedule: schedule
        };
        
    } catch (error) {
        console.error('Error scheduling command:', error);
        return {
            success: false,
            message: `Failed to schedule command: ${error.message}`,
            code: 'E_SCHEDULE_FAILED'
        };
    }
}

// List all schedules
async function listSchedules() {
    try {
        const schedules = await loadSchedules();
        
        // Update active schedules with current status
        const now = new Date();
        const updatedSchedules = schedules.map(schedule => {
            if (schedule.status === 'active') {
                const nextExecution = new Date(schedule.nextExecution);
                if (nextExecution <= now && schedule.repeat === 'once') {
                    schedule.status = 'overdue';
                }
            }
            return schedule;
        });
        
        return {
            success: true,
            schedules: updatedSchedules,
            total: updatedSchedules.length,
            active: updatedSchedules.filter(s => s.status === 'active').length,
            completed: updatedSchedules.filter(s => s.status === 'completed').length,
            cancelled: updatedSchedules.filter(s => s.status === 'cancelled').length
        };
        
    } catch (error) {
        console.error('Error listing schedules:', error);
        return {
            success: false,
            message: `Failed to list schedules: ${error.message}`,
            schedules: [],
            total: 0,
            active: 0,
            completed: 0,
            cancelled: 0
        };
    }
}

// Cancel a schedule
async function cancelSchedule(scheduleId) {
    try {
        // Cancel the active schedule
        if (activeSchedules.has(scheduleId)) {
            const activeSchedule = activeSchedules.get(scheduleId);
            
            if (activeSchedule.type === 'timeout') {
                clearTimeout(activeSchedule.id);
            } else if (activeSchedule.type === 'interval') {
                clearInterval(activeSchedule.id);
            }
            
            activeSchedules.delete(scheduleId);
        }
        
        // Update in file
        const schedules = await loadSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
        
        if (scheduleIndex !== -1) {
            schedules[scheduleIndex].status = 'cancelled';
            schedules[scheduleIndex].cancelledAt = new Date().toISOString();
            await saveSchedules(schedules);
            
            console.log(`Schedule ${scheduleId} cancelled`);
            
            return {
                success: true,
                message: `Schedule ${scheduleId} cancelled successfully`
            };
        } else {
            return {
                success: false,
                message: `Schedule ${scheduleId} not found`,
                code: 'E_SCHEDULE_NOT_FOUND'
            };
        }
        
    } catch (error) {
        console.error('Error cancelling schedule:', error);
        return {
            success: false,
            message: `Failed to cancel schedule: ${error.message}`,
            code: 'E_CANCEL_SCHEDULE_FAILED'
        };
    }
}

// Get schedule statistics
async function getScheduleStats() {
    try {
        const schedules = await loadSchedules();
        const now = new Date();
        
        const stats = {
            total: schedules.length,
            active: schedules.filter(s => s.status === 'active').length,
            completed: schedules.filter(s => s.status === 'completed').length,
            cancelled: schedules.filter(s => s.status === 'cancelled').length,
            overdue: schedules.filter(s => {
                if (s.status === 'active' && s.repeat === 'once') {
                    return new Date(s.nextExecution) <= now;
                }
                return false;
            }).length,
            nextExecution: null
        };
        
        // Find next execution time
        const activeSchedules = schedules.filter(s => s.status === 'active');
        if (activeSchedules.length > 0) {
            const nextExecutions = activeSchedules.map(s => new Date(s.nextExecution));
            stats.nextExecution = new Date(Math.min(...nextExecutions)).toISOString();
        }
        
        return stats;
        
    } catch (error) {
        console.error('Error getting schedule stats:', error);
        return {
            total: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
            overdue: 0,
            nextExecution: null
        };
    }
}

// Initialize scheduler on startup
async function initializeScheduler() {
    try {
        console.log('Initializing scheduler...');
        
        // Load existing schedules
        const schedules = await loadSchedules();
        const now = new Date();
        
        for (const schedule of schedules) {
            if (schedule.status === 'active') {
                const nextExecution = new Date(schedule.nextExecution);
                
                if (nextExecution > now) {
                    // Schedule is still valid, reschedule it
                    const delay = nextExecution.getTime() - now.getTime();
                    
                    if (schedule.repeat === 'once') {
                        const timeoutId = setTimeout(async () => {
                            await executeScheduledCommand(schedule.id, schedule.command, false);
                        }, delay);
                        
                        activeSchedules.set(schedule.id, {
                            type: 'timeout',
                            id: timeoutId,
                            schedule: schedule
                        });
                    } else {
                        const intervalId = setInterval(async () => {
                            await executeScheduledCommand(schedule.id, schedule.command, true);
                            
                            // Update next execution time
                            const nextExecution = calculateNextExecution(schedule);
                            schedule.nextExecution = nextExecution.toISOString();
                            
                            // Update in file
                            const schedules = await loadSchedules();
                            const scheduleIndex = schedules.findIndex(s => s.id === schedule.id);
                            if (scheduleIndex !== -1) {
                                schedules[scheduleIndex].nextExecution = nextExecution.toISOString();
                                await saveSchedules(schedules);
                            }
                        }, delay);
                        
                        activeSchedules.set(schedule.id, {
                            type: 'interval',
                            id: intervalId,
                            schedule: schedule
                        });
                    }
                    
                    console.log(`Rescheduled: ${schedule.command} for ${nextExecution.toLocaleString()}`);
                } else {
                    // Schedule is overdue, mark as completed if one-time
                    if (schedule.repeat === 'once') {
                        await markScheduleCompleted(schedule.id);
                    }
                }
            }
        }
        
        console.log(`Scheduler initialized with ${activeSchedules.size} active schedules`);
        
    } catch (error) {
        console.error('Error initializing scheduler:', error);
    }
}

module.exports = {
    scheduleCommand,
    listSchedules,
    cancelSchedule,
    getScheduleStats,
    initializeScheduler,
    SCHEDULES_FILE
};
