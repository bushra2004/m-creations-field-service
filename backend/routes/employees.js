const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get All Employees
router.get('/employees', async (req, res) => {
    try {
        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT employee_id AS id, name, contact, password, status, join_date AS joinDate FROM employees ORDER BY created_at DESC');
            return res.json({ success: true, employees: rows });
        } else {
            return res.json({ success: true, employees: db.memoryStore.employees });
        }
    } catch (err) {
        console.error('Error fetching employees:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch employees' });
    }
});

// 2. Add / Register Employee
router.post(['/employees', '/employees/register'], async (req, res) => {
    const { name, contact } = req.body;

    if (!name || !contact) {
        return res.status(400).json({ success: false, message: 'Employee name and contact number are required' });
    }

    const trimmedName = name.trim();
    const trimmedContact = contact.trim();

    try {
        let employeesList = [];
        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT employee_id AS id, name FROM employees');
            employeesList = rows;
        } else {
            employeesList = db.memoryStore.employees;
        }

        if (employeesList.some(e => e.name.toLowerCase() === trimmedName.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Employee with this name already exists' });
        }

        const newId = 'EMP' + String(employeesList.length + 1).padStart(3, '0');
        const autoPassword = trimmedName.toLowerCase() + '123';
        const joinDate = new Date().toISOString().split('T')[0];

        const newEmployee = {
            id: newId,
            name: trimmedName,
            contact: trimmedContact,
            password: autoPassword,
            status: 'available',
            joinDate
        };

        if (!db.isFallback()) {
            await db.query(
                'INSERT INTO employees (employee_id, name, contact, password, status, join_date) VALUES (?, ?, ?, ?, ?, ?)',
                [newId, trimmedName, trimmedContact, autoPassword, 'available', joinDate]
            );
        } else {
            db.memoryStore.employees.push(newEmployee);
        }

        return res.status(201).json({
            success: true,
            employee: newEmployee,
            message: `Employee ${trimmedName} created successfully`
        });

    } catch (err) {
        console.error('Error adding employee:', err);
        return res.status(500).json({ success: false, message: 'Server error while adding employee' });
    }
});

// 3. Delete Employee
router.delete('/employees/:id', async (req, res) => {
    const { id } = req.params;

    try {
        if (!db.isFallback()) {
            // Check for active rides first
            const [rides] = await db.query('SELECT id FROM rides WHERE employee_id = ? AND status != "completed"', [id]);
            if (rides.length > 0) {
                return res.status(400).json({ success: false, message: 'Cannot delete employee with active rides' });
            }

            const [result] = await db.query('DELETE FROM employees WHERE employee_id = ?', [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }
        } else {
            const hasActiveRide = db.memoryStore.rides.some(r => r.employeeId === id && r.status !== 'completed');
            if (hasActiveRide) {
                return res.status(400).json({ success: false, message: 'Cannot delete employee with active rides' });
            }
            const index = db.memoryStore.employees.findIndex(e => e.id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }
            db.memoryStore.employees.splice(index, 1);
        }

        return res.json({ success: true, message: 'Employee deleted successfully' });

    } catch (err) {
        console.error('Error deleting employee:', err);
        return res.status(500).json({ success: false, message: 'Server error deleting employee' });
    }
});

// 4. Get Pending Remote Login Requests
router.get('/admin/requests', async (req, res) => {
    try {
        if (!db.isFallback()) {
            const [rows] = await db.query(
                `SELECT request_id AS id, employee_id AS employeeId, employee_name AS employeeName, 
                        lat, lng, request_time AS timestamp, status 
                 FROM login_requests 
                 WHERE status = 'pending' 
                 ORDER BY request_time DESC`
            );
            return res.json({ success: true, requests: rows });
        } else {
            const pending = db.memoryStore.login_requests.filter(r => r.status === 'pending');
            return res.json({ success: true, requests: pending });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error loading pending login requests' });
    }
});

// 5. Approve Remote Login Request
router.put('/admin/requests/:id/approve', async (req, res) => {
    const { id } = req.params;

    try {
        const approvedAt = new Date();
        let requestObj = null;

        if (!db.isFallback()) {
            const [rows] = await db.query('SELECT * FROM login_requests WHERE request_id = ?', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Login request not found' });
            }
            requestObj = rows[0];

            await db.query(
                'UPDATE login_requests SET status = "approved", approved_at = ?, approved_by = "Admin" WHERE request_id = ?',
                [approvedAt, id]
            );

            // Mark attendance as remote_approved
            const today = new Date().toISOString().split('T')[0];
            const dist = db.calculateDistance(requestObj.lat, requestObj.lng, parseFloat(process.env.OFFICE_LAT || '17.307873'), parseFloat(process.env.OFFICE_LNG || '76.822892'));

            await db.query(
                `INSERT INTO attendance (employee_id, employee_name, date, login_time, checkin_lat, checkin_lng, distance_from_office, checkin_type, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'remote_approved', 'present')
                 ON DUPLICATE KEY UPDATE checkin_type = 'remote_approved';`,
                [requestObj.employee_id, requestObj.employee_name, today, approvedAt, requestObj.lat, requestObj.lng, dist]
            );

        } else {
            const index = db.memoryStore.login_requests.findIndex(r => r.id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'Login request not found' });
            }
            db.memoryStore.login_requests[index].status = 'approved';
            db.memoryStore.login_requests[index].approvedAt = approvedAt.toISOString();
            db.memoryStore.login_requests[index].approvedBy = 'Admin';
            requestObj = db.memoryStore.login_requests[index];

            const today = new Date().toISOString().split('T')[0];
            const dist = db.calculateDistance(requestObj.lat, requestObj.lng, parseFloat(process.env.OFFICE_LAT || '17.307873'), parseFloat(process.env.OFFICE_LNG || '76.822892'));

            const existingAtt = db.memoryStore.attendance.find(a => a.employeeId === requestObj.employeeId && a.date === today);
            if (!existingAtt) {
                db.memoryStore.attendance.push({
                    employeeId: requestObj.employeeId,
                    employeeName: requestObj.employeeName,
                    date: today,
                    loginTime: approvedAt.toISOString(),
                    checkinLat: requestObj.lat,
                    checkinLng: requestObj.lng,
                    distanceFromOffice: dist,
                    checkinType: 'remote_approved',
                    status: 'present',
                    ridesCompleted: 0,
                    totalKM: 0,
                    customerIds: []
                });
            }
        }

        // Emit Socket.IO event to alert connected clients
        const io = req.app.get('io');
        if (io) {
            io.emit('request_status_changed', { requestId: id, status: 'approved' });
        }

        return res.json({ success: true, message: 'Remote login request approved' });

    } catch (err) {
        console.error('Error approving request:', err);
        return res.status(500).json({ success: false, message: 'Server error approving request' });
    }
});

// 6. Reject Remote Login Request
router.put('/admin/requests/:id/reject', async (req, res) => {
    const { id } = req.params;

    try {
        if (!db.isFallback()) {
            const [result] = await db.query('UPDATE login_requests SET status = "rejected" WHERE request_id = ?', [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Login request not found' });
            }
        } else {
            const index = db.memoryStore.login_requests.findIndex(r => r.id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'Login request not found' });
            }
            db.memoryStore.login_requests[index].status = 'rejected';
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('request_status_changed', { requestId: id, status: 'rejected' });
        }

        return res.json({ success: true, message: 'Remote login request rejected' });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error rejecting request' });
    }
});

module.exports = router;
