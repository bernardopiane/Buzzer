// @ts-check
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { GameServer } from './model/gameServer.js';

// Setup Express and Socket.io
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Initialize game server
const gameServer = new GameServer(io);

// Static file serving
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, 'public')));

// Create login file
import * as fs from 'fs';
import * as path from 'path';

const credentials = {
    username: 'admin',
    password: 'password123'
};


function getLoginCredentials(folderPath, fileName) {
    const filePath = path.join(folderPath, fileName);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        try {
            // Parse the file and assign the credentials
            const parsedCredentials = JSON.parse(fileContent);
            credentials.username = parsedCredentials.username;
            credentials.password = parsedCredentials.password;
            return credentials;
        } catch (error) {
            console.error(`Error parsing login credentials: ${error}`);
            return null;
        }
    } else {
        // Create the file with default credentials
        const credentialsJson = JSON.stringify(credentials, null, 2);
        fs.writeFileSync(filePath, credentialsJson);
        return credentials;
    }
}

getLoginCredentials(__dirname, 'login.json');
// End of create login file

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    const auth = { login: credentials.username, password: credentials.password }; // Default credentials

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === auth.login && password === auth.password) {
        res.sendFile(join(__dirname, 'admin.html'));
    } else {
        res.set('WWW-Authenticate', 'Basic realm="401"');
        res.status(401).send('Authentication required.');
    }
});

// Socket.io event handlers
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('chat message', (msg) => {
        if (typeof msg !== 'string') return;
        io.emit('chat message', msg);
    });

    socket.on('login', (name) => {
        if (typeof name !== 'string') return;

        const success = gameServer.handleLogin(socket.id, name);
        if (success) {
            socket.emit('login success', `Welcome, ${name}!`);
        } else {
            socket.emit('login error', 'Unable to join game');
        }
    });

    socket.on('buzz', () => {
        const success = gameServer.handleBuzz(socket.id);
        if (!success) {
            socket.emit('buzz error', 'Buzzer input not accepted');
        }
    });

    socket.on('settings', (settings) => {
        if (!settings || typeof settings.maxPlayers !== 'number') return;

        const success = gameServer.updateSettings(settings);
        if (!success) {
            socket.emit('settings error', 'Invalid settings');
        }
    });

    socket.on('resetBuzzer', () => {
        gameServer.resetBuzzer();
    });

    socket.on('scoreChange', (data) => {
        if (typeof data.name !== 'string' || typeof data.score !== 'number') return;
        gameServer.changeScore(data.name, data.score);
    })

    socket.on('disconnect', () => {
        gameServer.handleDisconnect(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(3000, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:3000`);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});