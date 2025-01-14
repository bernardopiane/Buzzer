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

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'admin.html'));
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
