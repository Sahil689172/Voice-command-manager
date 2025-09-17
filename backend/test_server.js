const express = require('express');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001; // Use different port to avoid conflicts

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: "Test server running",
        port: PORT,
        features: ["Speech-to-Text"]
    });
});

// Speech-to-text transcription endpoint
app.post('/api/transcribe', upload.single('audio'), (req, res) => {
    const audioPath = path.resolve(req.file.path);
    const whisperBin = path.resolve('../../whisper.cpp/build/bin/whisper-cli');
    const modelPath = path.resolve('../../whisper.cpp/models/ggml-base.en.bin');

    const cmd = `${whisperBin} -m ${modelPath} -f ${audioPath}`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Transcription error: ${stderr}`);
            return res.status(500).json({ error: 'Transcription failed' });
        }
        res.json({ text: stdout.trim() });
    });
});

app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
