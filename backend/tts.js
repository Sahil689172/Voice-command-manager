// VOICE-CMD Text-to-Speech Module
// This module provides TTS functionality for reading command results aloud

const { exec } = require('child_process');

/**
 * Speak Text
 * This function converts text to speech using system TTS
 * 
 * @param {string} text - The text to be spoken
 * @returns {Promise<boolean>} - True if TTS was successful, false otherwise
 */
async function speakText(text) {
    return new Promise((resolve) => {
        try {
            // Clean text for TTS (remove special characters, limit length)
            const cleanText = text
                .replace(/[^\w\s.,!?]/g, ' ') // Remove special characters except basic punctuation
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim()
                .substring(0, 200); // Limit to 200 characters to avoid very long speech
            
            if (!cleanText) {
                console.log('TTS: No text to speak');
                resolve(false);
                return;
            }
            
            // Try different TTS methods based on system availability
            const ttsCommands = [
                // espeak (common on Linux)
                `espeak "${cleanText}"`,
                // festival (alternative TTS)
                `echo "${cleanText}" | festival --tts`,
                // spd-say (speech-dispatcher)
                `spd-say "${cleanText}"`
            ];
            
            let commandIndex = 0;
            
            function tryNextCommand() {
                if (commandIndex >= ttsCommands.length) {
                    console.log('TTS: No TTS engine available on this system');
                    resolve(false);
                    return;
                }
                
                const command = ttsCommands[commandIndex];
                console.log(`TTS: Trying command: ${command}`);
                
                exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`TTS: Command failed: ${error.message}`);
                        commandIndex++;
                        tryNextCommand();
                    } else {
                        console.log(`TTS: Successfully spoke: "${cleanText}"`);
                        resolve(true);
                    }
                });
            }
            
            tryNextCommand();
            
        } catch (ttsError) {
            console.error('TTS: Error in speakText:', ttsError.message);
            resolve(false);
        }
    });
}

/**
 * Check TTS Availability
 * This function checks if any TTS engine is available on the system
 * 
 * @returns {Promise<boolean>} - True if TTS is available, false otherwise
 */
async function checkTTSAvailability() {
    return new Promise((resolve) => {
        const checkCommands = [
            'which espeak',
            'which festival',
            'which spd-say'
        ];
        
        let available = false;
        let checked = 0;
        
        checkCommands.forEach(cmd => {
            exec(cmd, (error) => {
                checked++;
                if (!error) {
                    available = true;
                }
                if (checked === checkCommands.length) {
                    resolve(available);
                }
            });
        });
    });
}

module.exports = {
    speakText,
    checkTTSAvailability
};



