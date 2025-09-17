# 🎯 Cursor Project Instructions – Voice-Controlled Linux Process & File Manager

## 📌 Project Aim

We are building a voice-controlled Linux process & file manager with a web-based interface.
The project allows the user to speak commands (create/delete/move/copy files, open nano, list/kill processes, etc.) and executes them on the Ubuntu Linux terminal, with real-time feedback on the webpage.

## ✅ Steps to Follow

### 1. Setup Environment

- Ensure Ubuntu Linux environment is active (WSL or native).
- Initialize project in Cursor (npm init -y or Flask setup if using Python).
- Install required dependencies (express, node-pty, speechrecognition, psutil, etc.).

### 2. Frontend (Web UI)

Create a webpage with:

- Mic button 🎤 to capture voice input.
- Log area to display command results.
- Minimal UI (HTML, CSS, JS).
- Use Web Speech API (or connect to backend Whisper API) for speech → text.
- Send recognized text command to backend via REST or WebSocket.

### 3. Backend (Server)

- Use Node.js + Express (preferred) OR Flask (Python).
- Implement API endpoints or WebSocket for receiving commands.
- Map text commands → Linux shell commands:
  - mkdir, touch, nano, rm, cp, mv, ps, kill.
- Use node-pty (or Python subprocess) to execute commands safely.
- Return command execution results to frontend.

### 4. Command Processor

Build a parser that converts natural speech into Linux commands. Examples:

- "create a directory test" → mkdir test
- "create a file hello.c" → touch hello.c
- "delete file sample.txt" → rm sample.txt
- "list processes" → ps -aux
- "kill process 1234" → kill 1234
- "nano hello.c" → open nano in PTY
- "save file" → send CTRL+O, Enter, CTRL+X to nano

### 5. Feedback

- Show command results dynamically on webpage (success/error).
- Use TTS (speech synthesis) for audio feedback:
  - Example: "Directory created successfully".

### 6. Security

- Implement JWT/OAuth authentication for user access.
- Restrict commands to safe whitelisted set (avoid rm -rf /).

### 7. Deployment (Optional)

- Containerize app with Docker for portability.
- Ensure app runs on Linux with persistent storage.

## ❌ Do NOT Do

- Do not create features outside file/process management.
- Do not add unrelated modules (AI chatbots, unrelated APIs).
- Do not install random packages not aligned with project.
- Do not implement Windows-only features (Linux focus only).
- Do not bypass security → avoid running dangerous unrestricted commands.

## 📌 End Goal

A webpage where user clicks mic → speaks command → system executes on Linux terminal → result shown in UI + spoken feedback.

Functions include: create/delete/copy/move files, nano editing & saving, list/kill processes.

Everything works inside Ubuntu Linux with safe, secure execution.



