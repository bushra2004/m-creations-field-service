const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to format attendance rows
function formatAttendanceRow(a) {
    let custIds = [];
    if (a.customer_ids || a.customerIds) {
        try {
            const raw = a.customer_ids || a.customerIds;
            custIds = typeof raw === 'string' && raw.startsWith('[') ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [raw]);
        } catch (e) {
            custIds = [a.customer_ids || a.customerIds];
        }
    }
    return {
        id: a.id,
        employeeId: a.employee_id || a.employeeId,
        employeeName: a.employee_name || a.employeeName,
        date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
        loginTime: a.login_time || a.loginTime,
        checkinLat: a.checkin_lat !== undefined ? a.checkin_lat : a.checkinLat,
        checkinLng: a.checkin_lng !== undefined ? a.checkin_lng : a.checkinLng,
        distanceFromOffice: a.distance_from_office !== undefined ? a.distance_from_office : a.distanceFromOffice,
        checkinType: a.checkin_type || a.checkinType || 'auto',
        status: a.status || 'present',
        ridesCompleted: a.rides_completed !== undefined ? a.rides_completed : (a.ridesCompleted || 0),
        totalKM: a.total_km !== undefined ? a.total_km : (a.totalKM || 0),
        customerIds: custIds
    };
}

// 1. Get Attendance for specific date or all
router.get('/attendance/:date?', async (req, res) => {
    const { date } = req.params;
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
        if (!db.isFallback()) {
            let sql = 'SELECT * FROM attendance';
            const params = [];
            if (date && date !== 'all') {
                sql += ' WHERE date = ?';
                params.push(targetDate);
            }
            sql += ' ORDER BY login_time DESC';
            const [rows] = await db.query(sql, params);
            return res.json({ success: true, attendance: rows.map(formatAttendanceRow) });
        } else {
            let att = db.memoryStore.attendance;
            if (date && date !== 'all') {
                att = att.filter(a => a.date === targetDate);
            }
            return res.json({ success: true, attendance: att.map(formatAttendanceRow) });
        }
    } catch (err) {
        console.error('Error fetching attendance:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
    }
});

// 2. Get Attendance Date Range
router.get('/attendance/range/:start/:end', async (req, res) => {
    const { start, end } = req.params;

    try {
        if (!db.isFallback()) {
            const [rows] = await db.query(
                'SELECT * FROM attendance WHERE date >= ? AND date <= ? ORDER BY date DESC, login_time DESC',
                [start, end]
            );
            return res.json({ success: true, attendance: rows.map(formatAttendanceRow) });
        } else {
            const att = db.memoryStore.attendance.filter(a => a.date >= start && a.date <= end);
            return res.json({ success: true, attendance: att.map(formatAttendanceRow) });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch attendance range' });
    }
});

// 3. Clear Today's Attendance
router.delete('/attendance/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        if (!db.isFallback()) {
            await db.query('DELETE FROM attendance WHERE date = ?', [today]);
        } else {
            db.memoryStore.attendance = db.memoryStore.attendance.filter(a => a.date !== today);
        }
        return res.json({ success: true, message: `Today's attendance (${today}) cleared successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to clear today\'s attendance' });
    }
});

// 4. Clear All Attendance
router.delete('/attendance/all', async (req, res) => {
    try {
        if (!db.isFallback()) {
            await db.query('DELETE FROM attendance');
        } else {
            db.memoryStore.attendance = [];
        }
        return res.json({ success: true, message: 'All attendance records cleared successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to clear all attendance' });
    }
});

// 5. Generate Excel Daily Report (.xls format download)
router.get('/report/daily', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    try {
        let attendanceList = [];
        let completedRidesList = [];

        if (!db.isFallback()) {
            const [attRows] = await db.query('SELECT * FROM attendance WHERE date = ?', [today]);
            attendanceList = attRows.map(formatAttendanceRow);

            const [rideRows] = await db.query('SELECT * FROM rides WHERE status = "completed" AND DATE(end_time) = ?', [today]);
            completedRidesList = rideRows;
        } else {
            attendanceList = db.memoryStore.attendance.filter(a => a.date === today).map(formatAttendanceRow);
            completedRidesList = db.memoryStore.rides.filter(r => r.status === 'completed' && r.endTime && r.endTime.split('T')[0] === today);
        }

        let tableRows = '';
        if (attendanceList.length === 0) {
            tableRows = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:20px;color:#6b7280;">No attendance records for today</td>
                </tr>
            `;
        } else {
            attendanceList.forEach(a => {
                const empRides = completedRidesList.filter(r => (r.employee_id || r.employeeId) === a.employeeId);
                const customerIdsStr = a.customerIds && a.customerIds.length > 0 ? a.customerIds.join(', ') : 'None';
                const rideCount = a.ridesCompleted || empRides.length;
                const totalKM = a.totalKM || empRides.reduce((sum, r) => sum + (r.total_distance || r.totalDistance || 0), 0);

                const checkinLoc = `${a.checkinLat ? a.checkinLat.toFixed(6) : 'N/A'}, ${a.checkinLng ? a.checkinLng.toFixed(6) : 'N/A'}`;
                const loginTime = a.loginTime ? new Date(a.loginTime).toLocaleString() : 'N/A';
                const loginType = a.checkinType === 'auto' ? '🏢 Office' : '📱 Remote Approved';

                tableRows += `
                    <tr>
                        <td style="border:1px solid #ddd;padding:8px;">${a.employeeName}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${loginTime}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${loginType}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${checkinLoc}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${customerIdsStr}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${rideCount}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${totalKM.toFixed(2)} KM</td>
                    </tr>
                `;
            });
        }

        const totalRidesCount = completedRidesList.length;
        const grandTotalKM = attendanceList.reduce((sum, a) => sum + (a.totalKM || 0), 0);

        const html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>M Creations - Daily Field Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; border-bottom: 3px solid #0f3460; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { color: #0f3460; font-size: 28px; margin: 0; }
                    .header h1 span { color: #e94560; }
                    .header .sub { color: #6b7280; font-size: 14px; }
                    .header .brand { color: #0f3460; font-size: 12px; font-weight: bold; margin-top:5px; }
                    .summary { background: #f0f4ff; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
                    .summary table { width: 100%; }
                    .summary td { padding: 8px 15px; font-size: 14px; }
                    .summary .label { font-weight: bold; color: #0f3460; }
                    .summary .value { font-weight: bold; font-size: 18px; color: #1f2937; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
                    th { background: #0f3460; color: white; padding: 10px; border: 1px solid #0f3460; text-align: left; }
                    td { padding: 8px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f9fafb; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏢 M <span>Creations</span></h1>
                    <div class="sub">Daily Field Service Report</div>
                    <div class="brand">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
                <div class="summary">
                    <table>
                        <tr>
                            <td class="label">👥 Total Employees Present</td>
                            <td class="value">${attendanceList.length}</td>
                            <td class="label">🚗 Total Rides Completed</td>
                            <td class="value">${totalRidesCount}</td>
                        </tr>
                        <tr>
                            <td class="label">📏 Total KM Traveled</td>
                            <td class="value">${grandTotalKM.toFixed(2)} KM</td>
                            <td class="label">📍 Office Location</td>
                            <td class="value">Kalaburagi, Karnataka</td>
                        </tr>
                    </table>
                </div>
                <h3>📋 Employee Details</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Check-in Time</th>
                            <th>Login Type</th>
                            <th>Check-in Location</th>
                            <th>Customer IDs</th>
                            <th>Rides Completed</th>
                            <th>Total KM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr style="background:#e5e7eb; font-weight: bold;">
                            <td colspan="5" style="text-align: right;">TOTAL:</td>
                            <td>${totalRidesCount}</td>
                            <td>${grandTotalKM.toFixed(2)} KM</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <p>🏢 M <span style="color:#e94560;">Creations</span> — Field Service Excellence</p>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=m-creations-daily-report-${today}.xls`);
        return res.send(html);

    } catch (err) {
        console.error('Error generating Excel report:', err);
        return res.status(500).send('Error generating report');
    }
});

module.exports = router;
