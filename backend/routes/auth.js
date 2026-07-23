const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'm_creations_super_secret_jwt_key_2026';
const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT || '17.307873');
const OFFICE_LNG = parseFloat(process.env.OFFICE_LNG || '76.822892');
const OFFICE_RADIUS_KM = parseFloat(process.env.OFFICE_RADIUS_KM || '0.100');

// 1. Admin Login
router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mohsin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mohsin75333';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin', username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            success: true,
            token,
            message: 'Admin login successful'
        });
    }

    return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
    });
});

// 2. Employee Login with Geo-Fencing
router.post('/login', async (req, res) => {
    const { username, password, lat, lng } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        let employee = null;

        if (!db.isFallback()) {
            const [rows] = await db.query(
                'SELECT * FROM employees WHERE LOWER(name) = LOWER(?)',
                [username.trim()]
            );
            if (rows.length > 0) {
                employee = {
                    id: rows[0].employee_id,
                    name: rows[0].name,
                    contact: rows[0].contact,
                    password: rows[0].password,
                    status: rows[0].status,
                    joinDate: rows[0].join_date
                };
            }
        } else {
            employee = db.memoryStore.employees.find(e => e.name.toLowerCase() === username.trim().toLowerCase());
        }

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        if (employee.password !== password.trim()) {
            return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        const employeeLat = parseFloat(lat);
        const employeeLng = parseFloat(lng);

        if (isNaN(employeeLat) || isNaN(employeeLng)) {
            return res.status(400).json({ success: false, message: 'Valid GPS coordinates (lat, lng) are required' });
        }

        const distance = db.calculateDistance(employeeLat, employeeLng, OFFICE_LAT, OFFICE_LNG);
        const withinOffice = distance <= OFFICE_RADIUS_KM;
        const distMeters = Math.round(distance * 1000);

        if (withinOffice) {
            // Auto Login - Employee within 100m of office
            const token = jwt.sign(
                { role: 'employee', id: employee.id, name: employee.name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            const today = new Date().toISOString().split('T')[0];
            const loginTime = new Date();

            if (!db.isFallback()) {
                await db.query(
                    `INSERT INTO attendance (employee_id, employee_name, date, login_time, checkin_lat, checkin_lng, distance_from_office, checkin_type, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', 'present')
                     ON DUPLICATE KEY UPDATE checkin_lat = VALUES(checkin_lat), checkin_lng = VALUES(checkin_lng);`,
                    [employee.id, employee.name, today, loginTime, employeeLat, employeeLng, distance]
                );
            } else {
                const existing = db.memoryStore.attendance.find(a => a.employeeId === employee.id && a.date === today);
                if (!existing) {
                    db.memoryStore.attendance.push({
                        employeeId: employee.id,
                        employeeName: employee.name,
                        date: today,
                        loginTime: loginTime.toISOString(),
                        checkinLat: employeeLat,
                        checkinLng: employeeLng,
                        distanceFromOffice: distance,
                        checkinType: 'auto',
                        status: 'present',
                        ridesCompleted: 0,
                        totalKM: 0,
                        customerIds: []
                    });
                }
            }

            return res.json({
                success: true,
                withinOffice: true,
                employee,
                token,
                distance,
                message: '✅ Logged in from office. Attendance marked.'
            });

        } else {
            // Outside 100m - Create pending login request
            const requestId = 'REQ-' + Date.now();
            const requestTime = new Date();

            if (!db.isFallback()) {
                await db.query(
                    `INSERT INTO login_requests (request_id, employee_id, employee_name, lat, lng, request_time, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [requestId, employee.id, employee.name, employeeLat, employeeLng, requestTime]
                );
            } else {
                db.memoryStore.login_requests.push({
                    id: requestId,
                    employeeId: employee.id,
                    employeeName: employee.name,
                    lat: employeeLat,
                    lng: employeeLng,
                    timestamp: requestTime.toISOString(),
                    status: 'pending',
                    approvedAt: null,
                    approvedBy: null
                });
            }

            // Broadcast real-time login request alert via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to('admin').emit('new_login_request', {
                    id: requestId,
                    employeeId: employee.id,
                    employeeName: employee.name,
                    lat: employeeLat,
                    lng: employeeLng,
                    timestamp: requestTime.toISOString(),
                    distanceMeters: distMeters
                });
            }

            return res.json({
                success: false,
                withinOffice: false,
                requestId,
                employee,
                distance,
                message: `⚠️ You are ${distMeters} meters from office. Request sent to Admin.`
            });
        }

    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ success: false, message: 'Server error during login process' });
    }
});

// 3. Poll Request Status
router.get('/login/request/:requestId', async (req, res) => {
    const { requestId } = req.params;
    try {
        let request = null;

        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT * FROM login_requests WHERE request_id = ?', [requestId]);
            if (rows.length > 0) {
                request = {
                    id: rows[0].request_id,
                    employeeId: rows[0].employee_id,
                    employeeName: rows[0].employee_name,
                    status: rows[0].status
                };
            }
        } else {
            request = db.memoryStore.login_requests.find(r => r.id === requestId);
        }

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status === 'approved') {
            // Generate token for approved login
            let employee = null;
            if (!db.isFallback()) {
                const [empRows] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [request.employeeId]);
                if (empRows.length > 0) {
                    employee = {
                        id: empRows[0].employee_id,
                        name: empRows[0].name,
                        contact: empRows[0].contact,
                        status: empRows[0].status,
                        joinDate: empRows[0].join_date
                    };
                }
            } else {
                employee = db.memoryStore.employees.find(e => e.id === request.employeeId);
            }

            const token = jwt.sign(
                { role: 'employee', id: request.employeeId, name: request.employeeName },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                success: true,
                status: 'approved',
                employee,
                token,
                message: 'Admin approved login'
            });
        }

        return res.json({
            success: true,
            status: request.status
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking request status' });
    }
});

module.exports = router;
