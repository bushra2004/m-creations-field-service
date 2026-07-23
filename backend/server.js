const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const rideRoutes = require('./routes/rides');
const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/locations');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Attach io instance to app
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend serving
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));
app.use(express.static(path.join(__dirname, '..'))); // Root fallback for dev

// API Routes
app.use('/api', authRoutes);
app.use('/api', employeeRoutes);
app.use('/api', rideRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', locationRoutes);

// Socket.IO Room Management & Live Broadcasts
io.on('connection', (socket) => {
    console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

    // Admin joins tracking room
    socket.on('join_admin', () => {
        socket.join('admin');
        console.log(`👑 Admin joined real-time room [${socket.id}]`);
    });

    // Employee registers socket connection
    socket.on('join_employee', (data) => {
        if (data && data.employeeId) {
            socket.join(`employee_${data.employeeId}`);
            console.log(`👷 Employee ${data.employeeId} registered socket [${socket.id}]`);
        }
    });

    // Live Location broadcast from socket
    socket.on('location_update', async (data) => {
        if (!data || !data.employeeId) return;
        const { employeeId, lat, lng, customerId } = data;

        // Broadcast to all admins in real-time
        io.to('admin').emit('location_updated', {
            employeeId,
            lat,
            lng,
            customerId,
            updatedAt: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Fallback index.html for SPA routing
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, '../index.html'));
        }
    });
});

// Start Server with Port Fallback Error Handling
const INITIAL_PORT = parseInt(process.env.PORT || '5001');

async function startServer(portToTry) {
    await db.initDB();
    
    server.listen(portToTry, () => {
        console.log(`
======================================================
🚀 M CREATIONS BACKEND SERVER IS RUNNING
======================================================
📡 Express API & Socket.IO: http://localhost:${portToTry}
📍 Office Location: Kalaburagi, Karnataka (17.307873, 76.822892)
📏 Office Radius: 100 meters
======================================================
        `);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️ Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
            setTimeout(() => {
                server.close();
                server.listen(portToTry + 1);
            }, 500);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(INITIAL_PORT);
