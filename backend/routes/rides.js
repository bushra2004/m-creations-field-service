const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to format ride object
function formatRide(r) {
    let locUpdates = [];
    if (r.location_updates) {
        try {
            locUpdates = typeof r.location_updates === 'string' ? JSON.parse(r.location_updates) : r.location_updates;
        } catch (e) { }
    }
    return {
        id: r.id,
        employeeId: r.employee_id || r.employeeId,
        customerId: r.customer_id || r.customerId,
        status: r.status,
        startTime: r.start_time || r.startTime,
        endTime: r.end_time || r.endTime,
        startLat: r.start_lat || r.startLat,
        startLng: r.start_lng || r.startLng,
        endLat: r.end_lat || r.endLat,
        endLng: r.end_lng || r.endLng,
        totalDistance: r.total_distance !== undefined ? r.total_distance : (r.totalDistance || 0),
        duration: r.duration || 0,
        locationUpdates: locUpdates,
        completed: r.status === 'completed'
    };
}

// 1. Get All Rides / Rides for Employee
router.get('/rides', async (req, res) => {
    const { employeeId, status } = req.query;

    try {
        if (!db.isFallback()) {
            let sql = 'SELECT * FROM rides WHERE 1=1';
            const params = [];

            if (employeeId) {
                sql += ' AND employee_id = ?';
                params.push(employeeId);
            }
            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }

            sql += ' ORDER BY start_time DESC';
            const [rows] = await db.query(sql, params);
            const rides = rows.map(formatRide);
            return res.json({ success: true, rides });
        } else {
            let rides = db.memoryStore.rides;
            if (employeeId) {
                rides = rides.filter(r => r.employeeId === employeeId);
            }
            if (status) {
                rides = rides.filter(r => r.status === status);
            }
            return res.json({ success: true, rides });
        }
    } catch (err) {
        console.error('Error fetching rides:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch rides' });
    }
});

// 2. Start a Ride
router.post('/rides/start', async (req, res) => {
    const { employeeId, customerId, lat, lng } = req.body;

    if (!employeeId || !customerId) {
        return res.status(400).json({ success: false, message: 'employeeId and customerId are required' });
    }

    const startLat = parseFloat(lat) || 0;
    const startLng = parseFloat(lng) || 0;
    const startTime = new Date();
    const cleanCustomerId = customerId.trim();

    try {
        let activeRides = [];
        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT * FROM rides WHERE employee_id = ? AND status = "in_progress"', [employeeId]);
            activeRides = rows;
        } else {
            activeRides = db.memoryStore.rides.filter(r => r.employeeId === employeeId && r.status === 'in_progress');
        }

        if (activeRides.length > 0) {
            return res.status(400).json({ success: false, message: 'Employee already has an active ride in progress' });
        }

        const initialUpdates = [{ lat: startLat, lng: startLng, timestamp: startTime.toISOString() }];

        let newRideId = Date.now();
        if (!db.isFallback()) {
            const [result] = await db.query(
                `INSERT INTO rides (customer_id, employee_id, status, start_time, start_lat, start_lng, location_updates)
                 VALUES (?, ?, 'in_progress', ?, ?, ?, ?)`,
                [cleanCustomerId, employeeId, startTime, startLat, startLng, JSON.stringify(initialUpdates)]
            );
            newRideId = result.insertId;
        }

        const rideObj = {
            id: newRideId,
            employeeId,
            customerId: cleanCustomerId,
            status: 'in_progress',
            startTime: startTime.toISOString(),
            startLat,
            startLng,
            endTime: null,
            endLat: null,
            endLng: null,
            totalDistance: 0,
            duration: 0,
            locationUpdates: initialUpdates,
            completed: false
        };

        if (db.isFallback()) {
            db.memoryStore.rides.push(rideObj);
        }

        // Emit Socket.IO event for active ride start
        const io = req.app.get('io');
        if (io) {
            io.emit('ride_updated', { type: 'start', ride: rideObj });
        }

        return res.status(201).json({
            success: true,
            ride: rideObj,
            message: `Service started for customer ${cleanCustomerId}`
        });

    } catch (err) {
        console.error('Error starting ride:', err);
        return res.status(500).json({ success: false, message: 'Server error starting ride' });
    }
});

// 3. Complete a Ride
router.put('/rides/complete', async (req, res) => {
    const { rideId, customerId, endLat, endLng } = req.body;
    const identifier = rideId || customerId;

    if (!identifier) {
        return res.status(400).json({ success: false, message: 'rideId or customerId is required' });
    }

    const eLat = parseFloat(endLat) || 0;
    const eLng = parseFloat(endLng) || 0;
    const endTime = new Date();

    try {
        let ride = null;

        if (!db.isFallback()) {
            const [rows] = await db.query(
                'SELECT * FROM rides WHERE (id = ? OR customer_id = ?) AND status = "in_progress" ORDER BY start_time DESC LIMIT 1',
                [identifier, identifier]
            );
            if (rows.length > 0) {
                ride = rows[0];
            }
        } else {
            ride = db.memoryStore.rides.find(r => (r.id == identifier || r.customerId == identifier) && r.status === 'in_progress');
        }

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Active ride not found' });
        }

        const sTime = new Date(ride.start_time || ride.startTime);
        const durationMinutes = Math.round((endTime - sTime) / 1000 / 60);

        let locUpdates = [];
        try {
            const rawUpdates = ride.location_updates || ride.locationUpdates;
            locUpdates = typeof rawUpdates === 'string' ? JSON.parse(rawUpdates) : (rawUpdates || []);
        } catch (e) { }

        locUpdates.push({ lat: eLat, lng: eLng, timestamp: endTime.toISOString() });

        let totalKM = 0;
        if (locUpdates.length > 1) {
            for (let i = 1; i < locUpdates.length; i++) {
                const prev = locUpdates[i - 1];
                const curr = locUpdates[i];
                totalKM += db.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            }
        }
        totalKM = Math.round(totalKM * 100) / 100;

        const empId = ride.employee_id || ride.employeeId;
        const custId = ride.customer_id || ride.customerId;

        if (!db.isFallback()) {
            await db.query(
                `UPDATE rides 
                 SET status = 'completed', end_time = ?, end_lat = ?, end_lng = ?, duration = ?, total_distance = ?, location_updates = ?
                 WHERE id = ?`,
                [endTime, eLat, eLng, durationMinutes, totalKM, JSON.stringify(locUpdates), ride.id]
            );

            // Update attendance record stats
            const today = new Date().toISOString().split('T')[0];
            const [attRows] = await db.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [empId, today]);
            if (attRows.length > 0) {
                let existingCustIds = [];
                if (attRows[0].customer_ids) {
                    try { existingCustIds = JSON.parse(attRows[0].customer_ids); }
                    catch (e) { existingCustIds = attRows[0].customer_ids.split(',').map(s => s.trim()); }
                }
                if (custId && !existingCustIds.includes(custId)) {
                    existingCustIds.push(custId);
                }

                await db.query(
                    `UPDATE attendance 
                     SET rides_completed = rides_completed + 1, total_km = total_km + ?, customer_ids = ?
                     WHERE employee_id = ? AND date = ?`,
                    [totalKM, JSON.stringify(existingCustIds), empId, today]
                );
            }
        } else {
            ride.status = 'completed';
            ride.completed = true;
            ride.endTime = endTime.toISOString();
            ride.endLat = eLat;
            ride.endLng = eLng;
            ride.duration = durationMinutes;
            ride.totalDistance = totalKM;
            ride.locationUpdates = locUpdates;

            // Memory attendance update
            const today = new Date().toISOString().split('T')[0];
            const att = db.memoryStore.attendance.find(a => a.employeeId === empId && a.date === today);
            if (att) {
                att.ridesCompleted = (att.ridesCompleted || 0) + 1;
                att.totalKM = (att.totalKM || 0) + totalKM;
                if (!att.customerIds) att.customerIds = [];
                if (custId && !att.customerIds.includes(custId)) {
                    att.customerIds.push(custId);
                }
            }
        }

        const completedRideObj = {
            id: ride.id,
            employeeId: empId,
            customerId: custId,
            status: 'completed',
            startTime: sTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationMinutes,
            totalDistance: totalKM,
            completed: true
        };

        const io = req.app.get('io');
        if (io) {
            io.emit('ride_updated', { type: 'complete', ride: completedRideObj });
        }

        return res.json({
            success: true,
            ride: completedRideObj,
            message: `Service completed! Duration: ${durationMinutes} min, Total: ${totalKM} KM`
        });

    } catch (err) {
        console.error('Error completing ride:', err);
        return res.status(500).json({ success: false, message: 'Server error completing ride' });
    }
});

module.exports = router;
