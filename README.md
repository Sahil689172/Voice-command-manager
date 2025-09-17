# VOICE-CMD - Voice-Controlled Linux Process & File Manager

A web-based voice command system that allows you to control Linux processes and manage files through natural language commands. Built with Node.js/Express backend and vanilla HTML/CSS/JavaScript frontend.

## 🚀 Features

- **Voice Command Processing**: Convert natural language to Linux shell commands
- **File Management**: Create, delete, move, copy files and directories
- **Process Management**: List and kill running processes
- **Text Editor Integration**: Open files in nano editor
- **Real-time Feedback**: Web interface with live command execution results
- **Text-to-Speech**: Optional TTS support for command results
- **Command Logging**: Complete history of executed commands
- **Security**: Whitelist-based command validation

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Command Execution**: child_process.exec with security whitelist
- **TTS**: espeak, festival, spd-say (system commands)
- **Logging**: JSON-based command history

## 📁 Project Structure

```
Voice-cmd/
├── frontend/                 # Web interface
│   ├── index.html           # Main webpage
│   ├── style.css            # Styling
│   └── script.js            # Frontend logic
├── backend/                 # Node.js server
│   ├── server.js            # Express server
│   ├── commandUtils.js      # Command parsing & execution
│   ├── tts.js              # Text-to-Speech module
│   ├── package.json        # Dependencies
│   └── logs/               # Command history
│       └── commandHistory.json
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Python 3 (for frontend server)
- Linux/Ubuntu system
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sahil689172/Voice-command-manager.git
   cd Voice-command-manager
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Start the backend server**
   ```bash
   node server.js
   ```
   The server will run on `http://localhost:3000`

4. **Start the frontend server** (in a new terminal)
   ```bash
   cd frontend
   python3 -m http.server 8000
   ```
   The frontend will be available at `http://localhost:8000`

## 💻 Usage

### Supported Commands

| Voice Command | Linux Command | Description |
|---------------|---------------|-------------|
| "create directory X" | `mkdir X` | Create a new directory |
| "create file X" | `touch X` | Create a new file |
| "delete file X" | `rm X` | Delete a file |
| "move file X to Y" | `mv X Y` | Move/rename a file |
| "copy file X to Y" | `cp X Y` | Copy a file |
| "list files" | `ls -la` | List directory contents |
| "list processes" | `ps -aux` | List running processes |
| "kill process X" | `kill X` | Kill a process by PID |
| "open nano X" | `nano X` | Open file in nano editor |

### Using the Interface

1. **Text Input**: Type commands in the input field and click "Send"
2. **Voice Input**: Click the microphone button (placeholder for future voice recognition)
3. **Results**: View command execution results in the output log
4. **Real-time Updates**: The interface shows recognized commands and execution status

## 🔧 Configuration

### Backend Configuration

Edit `backend/server.js` to modify:

```javascript
const CONFIG = {
    TTS_ENABLED: true,     // Enable/disable Text-to-Speech
    LOG_COMMANDS: true     // Enable/disable command logging
};
```

### Working Directory

All commands execute in `~/Desktop/VOICE-CMD` directory for security and organization.

## 🔒 Security Features

- **Command Whitelist**: Only predefined safe commands are allowed
- **Isolated Working Directory**: Commands run in a controlled environment
- **Input Validation**: Basic validation of command parameters
- **Error Handling**: Comprehensive error catching and reporting

## 📝 Command Logging

All executed commands are logged to `backend/logs/commandHistory.json` with:
- Timestamp
- Original command text
- Mapped Linux command
- Execution output
- Error messages (if any)

## 🎤 Text-to-Speech

The system supports multiple TTS engines:
- **espeak** (primary)
- **festival** (fallback)
- **spd-say** (fallback)

TTS automatically reads command results and error messages.

## 🚧 Future Enhancements

- [ ] Real voice recognition integration (Web Speech API)
- [ ] WebSocket support for real-time updates
- [ ] User authentication and authorization
- [ ] Advanced command parsing with AI
- [ ] File upload/download capabilities
- [ ] Process monitoring and alerts
- [ ] Custom command aliases
- [ ] Multi-user support

## 🐛 Troubleshooting

### Common Issues

1. **Backend not starting**
   - Ensure Node.js is installed
   - Check if port 3000 is available
   - Run `npm install` in backend directory

2. **Frontend not loading**
   - Ensure Python 3 is installed
   - Check if port 8000 is available
   - Verify all files are in the frontend directory

3. **Commands not executing**
   - Check if the command is in the whitelist
   - Verify the working directory exists
   - Check backend logs for errors

4. **TTS not working**
   - Install a TTS engine: `sudo apt install espeak`
   - Check TTS configuration in server.js

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Author

**Sahil** - [GitHub](https://github.com/Sahil689172)

## 🙏 Acknowledgments

- Express.js community for the excellent web framework
- Node.js community for the robust runtime
- Linux community for the powerful command-line tools

---

**Note**: This is a development project. Use with caution in production environments and always review commands before execution.



