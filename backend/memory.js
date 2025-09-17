// VOICE-CMD Memory Module
// Persistent memory storage with context awareness

const fs = require("fs").promises;
const path = require("path");

const memoryFile = path.join(__dirname, "memory.json");

// Helper to load memory from file
async function loadMemory() {
  try {
    const data = await fs.readFile(memoryFile, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist, return empty object with default structure
    return {
      userData: {},
      commandHistory: [],
      context: {},
      lastUpdated: new Date().toISOString()
    };
  }
}

// Helper to save memory object back to file
async function saveMemoryToFile(memory) {
  memory.lastUpdated = new Date().toISOString();
  await fs.writeFile(memoryFile, JSON.stringify(memory, null, 2), "utf-8");
}

// Save a key-value pair into memory
async function saveMemory(key, value) {
  const memory = await loadMemory();
  memory.userData[key] = {
    value: value,
    timestamp: new Date().toISOString()
  };
  await saveMemoryToFile(memory);
  return { 
    status: "success", 
    message: `Memory saved: "${key}" = "${value}"`,
    key: key,
    value: value
  };
}

// Get a single memory value by key
async function getMemory(key) {
  const memory = await loadMemory();
  const item = memory.userData[key];
  if (item) {
    return {
      value: item.value,
      timestamp: item.timestamp,
      found: true
    };
  }
  return { found: false, message: `Memory not found: "${key}"` };
}

// Get all memory
async function getAllMemory() {
  const memory = await loadMemory();
  return {
    userData: memory.userData,
    commandHistory: memory.commandHistory,
    context: memory.context,
    lastUpdated: memory.lastUpdated,
    totalItems: Object.keys(memory.userData).length
  };
}

// Clear all memory
async function clearMemory() {
  await saveMemoryToFile({
    userData: {},
    commandHistory: [],
    context: {},
    lastUpdated: new Date().toISOString()
  });
  return { 
    status: "success", 
    message: "All memory cleared successfully" 
  };
}

// Add command to history
async function addCommandToHistory(command, result) {
  const memory = await loadMemory();
  
  const historyEntry = {
    command: command,
    result: result,
    timestamp: new Date().toISOString()
  };
  
  memory.commandHistory.unshift(historyEntry);
  
  // Keep only last 10 commands
  if (memory.commandHistory.length > 10) {
    memory.commandHistory = memory.commandHistory.slice(0, 10);
  }
  
  await saveMemoryToFile(memory);
  return historyEntry;
}

// Get recent command history
async function getCommandHistory(limit = 5) {
  const memory = await loadMemory();
  return memory.commandHistory.slice(0, limit);
}

// Set context information
async function setContext(key, value) {
  const memory = await loadMemory();
  memory.context[key] = {
    value: value,
    timestamp: new Date().toISOString()
  };
  await saveMemoryToFile(memory);
  return { 
    status: "success", 
    message: `Context set: "${key}" = "${value}"` 
  };
}

// Get context information
async function getContext(key) {
  const memory = await loadMemory();
  const item = memory.context[key];
  if (item) {
    return {
      value: item.value,
      timestamp: item.timestamp,
      found: true
    };
  }
  return { found: false, message: `Context not found: "${key}"` };
}

// Search memory for partial matches
async function searchMemory(query) {
  const memory = await loadMemory();
  const results = [];
  
  // Search in user data
  for (const [key, item] of Object.entries(memory.userData)) {
    if (key.toLowerCase().includes(query.toLowerCase()) || 
        item.value.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        type: 'userData',
        key: key,
        value: item.value,
        timestamp: item.timestamp
      });
    }
  }
  
  // Search in context
  for (const [key, item] of Object.entries(memory.context)) {
    if (key.toLowerCase().includes(query.toLowerCase()) || 
        item.value.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        type: 'context',
        key: key,
        value: item.value,
        timestamp: item.timestamp
      });
    }
  }
  
  return {
    query: query,
    results: results,
    count: results.length
  };
}

// Get memory statistics
async function getMemoryStats() {
  const memory = await loadMemory();
  return {
    totalUserData: Object.keys(memory.userData).length,
    totalContext: Object.keys(memory.context).length,
    totalCommands: memory.commandHistory.length,
    lastUpdated: memory.lastUpdated,
    memorySize: JSON.stringify(memory).length
  };
}

module.exports = {
  saveMemory,
  getMemory,
  getAllMemory,
  clearMemory,
  addCommandToHistory,
  getCommandHistory,
  setContext,
  getContext,
  searchMemory,
  getMemoryStats
};


