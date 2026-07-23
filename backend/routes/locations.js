const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Update Employee Live Location
router.post('/location/update', async (req, res) => {
    const { employeeId, lat, lng, customerId } = req.body;

    if (!employeeId || lat === undefined || lng === undefined) {
        return res.status(400).json({ success: false, message: 'employeeId, lat, and lng are required' });
    }

    const eLat = parseFloat(lat);
    const eLng = parseFloat(lng);
    const updatedAt = new Date();

    try {
        if (!db.isFallback()) {
            await db.query(
                `INSERT INTO employee_locations (employee_id, lat, lng, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), updated_at = VALUES(updated_at);`,
                [employeeId, eLat, eLng, updatedAt]
            );

            // Also append location to active ride if customerId is supplied
            if (customerId) {
                const [activeRides] = await db.query(
                    'SELECT * FROM rides WHERE (customer_id = ? OR employee_id = ?) AND status = "in_progress" LIMIT 1',
                    [customerId, employeeId]
                );
                if (activeRides.length > 0) {
                    const ride = activeRides[0];
                    let updates = [];
                    try { updates = typeof ride.location_updates === 'string' ? JSON.parse(ride.location_updates) : (ride.location_updates || []); } catch (e) { }
                    updates.push({ lat: eLat, lng: eLng, timestamp: updatedAt.toISOString() });
                    await db.query('UPDATE rides SET location_updates = ? WHERE id = ?', [JSON.stringify(updates), ride.id]);
                }
            }
        } else {
            db.memoryStore.employee_locations[employeeId] = {
                employeeId,
                lat: eLat,
                lng: eLng,
                customerId,
                updatedAt: updatedAt.toISOString()
            };

            if (customerId) {
                const ride = db.memoryStore.rides.find(r => (r.customerId == customerId || r.employeeId == employeeId) && r.status === 'in_progress');
                if (ride) {
                    if (!ride.locationUpdates) ride.locationUpdates = [];
                    ride.locationUpdates.push({ lat: eLat, lng: eLng, timestamp: updatedAt.toISOString() });
                }
            }
        }

        // Broadcast to Socket.IO Admin Room immediately (2-second live updates)
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('location_updated', {
                employeeId,
                lat: eLat,
                lng: eLng,
                customerId,
                updatedAt: updatedAt.toISOString()
            });
        }

        return res.json({ success: true, message: 'Location updated' });

    } catch (err) {
        console.error('Error updating location:', err);
        return res.status(500).json({ success: false, message: 'Error updating location' });
    }
});

// 2. Get All Live Locations
router.get('/locations', async (req, res) => {
    try {
        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT * FROM employee_locations');
            const locationsMap = {};
            rows.forEach(r => {
                locationsMap[r.employee_id] = {
                    employeeId: r.employee_id,
                    lat: r.lat,
                    lng: r.lng,
                    updatedAt: r.updated_at
                };
            });
            return res.json({ success: true, locations: locationsMap });
        } else {
            return res.json({ success: true, locations: db.memoryStore.employee_locations });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch live locations' });
    }
});

module.exports = router;
