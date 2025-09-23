import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { GameOrchestrator } from './state/orchestrator.js';
import { setupRoutes } from './routes/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

const orchestrator = new GameOrchestrator(io);

setupRoutes(app, orchestrator);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('player-action', async (data) => {
    try {
      await orchestrator.handlePlayerAction(socket, data);
    } catch (error) {
      console.error('Error handling player action:', error);
      socket.emit('error', { message: 'An error occurred processing your action' });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Agentic RPG server running on port ${PORT}`);
});