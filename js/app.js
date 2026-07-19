// ============================================
// M CREATIONS
// Field Service Tracking System
// ============================================

const Storage = {
    init() {
        console.log('🔧 M Creations Service Tracker initialized');
        
        // Office Location (Kalaburagi Office - Masjid E Hussain)
        this.OFFICE_LAT = 17.307873;
        this.OFFICE_LNG = 76.822892;
        this.OFFICE_RADIUS_KM = 0.100; // 100 meters
        
        if (!localStorage.getItem('employees')) {
            localStorage.setItem('employees', JSON.stringify([]));
        }
        
        if (!localStorage.getItem('rides')) { localStorage.setItem('rides', JSON.stringify([])); }
        if (!localStorage.getItem('liveLocations')) { localStorage.setItem('liveLocations', JSON.stringify({})); }
        if (!localStorage.getItem('rideCounter')) { localStorage.setItem('rideCounter', '1000'); }
        if (!localStorage.getItem('attendance')) { localStorage.setItem('attendance', JSON.stringify([])); }
        if (!localStorage.getItem('loginRequests')) { localStorage.setItem('loginRequests', JSON.stringify([])); }
        
        console.log('✅ M Creations System Ready');
        console.log(`📍 Office Location: ${this.OFFICE_LAT}, ${this.OFFICE_LNG}`);
        console.log(`📏 Office Radius: ${this.OFFICE_RADIUS_KM * 1000} meters`);
    },
    
    // ============================================
    // OFFICE LOCATION & GEO-FENCING
    // ============================================
    
    OFFICE_LAT: 17.307873,
    OFFICE_LNG: 76.822892,
    OFFICE_RADIUS_KM: 0.100,
    
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },
    
    isWithinOfficeRadius(lat, lng) {
        const dist = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
        return dist <= this.OFFICE_RADIUS_KM;
    },
    
    // ============================================
    // ADMIN AUTHENTICATION
    // ============================================
    
    adminLogin(username, password) {
        const ADMIN_USERNAME = 'mohsin';
        const ADMIN_PASSWORD = 'mohsin75333';
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            return { success: true };
        }
        return { success: false, message: 'Invalid admin credentials' };
    },
    
    isAdminLoggedIn() {
        return sessionStorage.getItem('adminLoggedIn') === 'true';
    },
    
    adminLogout() {
        sessionStorage.removeItem('adminLoggedIn');
        return true;
    },
    
    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================
    
    getEmployees() {
        try { return JSON.parse(localStorage.getItem('employees') || '[]'); } 
        catch(e) { console.error('Error loading employees:', e); return []; }
    },
    
    saveEmployees(employees) {
        try { localStorage.setItem('employees', JSON.stringify(employees)); return true; } 
        catch(e) { console.error('Error saving employees:', e); return false; }
    },
    
    getEmployeeByUsername(username) {
        const employees = this.getEmployees();
        return employees.find(e => e.name.toLowerCase() === username.toLowerCase());
    },
    
    getEmployeeById(id) {
        const employees = this.getEmployees();
        return employees.find(e => e.id === id);
    },
    
    addEmployee(name, contact) {
        const employees = this.getEmployees();
        
        if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
            alert('❌ Employee with this name already exists');
            return null;
        }
        
        const newId = 'EMP' + String(employees.length + 1).padStart(3, '0');
        const newEmployee = {
            id: newId,
            name: name.trim(),
            contact: contact.trim(),
            password: name.trim().toLowerCase() + '123',
            status: 'available',
            joinDate: new Date().toISOString().split('T')[0]
        };
        employees.push(newEmployee);
        this.saveEmployees(employees);
        console.log('✅ Employee added:', newEmployee);
        return newEmployee;
    },
    
    deleteEmployee(employeeId) {
        let employees = this.getEmployees();
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return false;
        const rides = this.getRides();
        const hasActiveRide = rides.some(r => r.employeeId === employeeId && r.status !== 'completed');
        if (hasActiveRide) {
            alert('❌ Cannot delete employee with active rides.');
            return false;
        }
        employees = employees.filter(e => e.id !== employeeId);
        this.saveEmployees(employees);
        return true;
    },
    
    // ============================================
    // LOGIN & REMOTE REQUEST SYSTEM
    // ============================================
    
    loginEmployee(username, password, lat, lng) {
        console.log('🔍 Login attempt:', username);
        
        const employee = this.getEmployeeByUsername(username);
        if (!employee) {
            return { success: false, message: 'Employee not found' };
        }
        if (employee.password !== password) {
            return { success: false, message: 'Incorrect password' };
        }
        
        const withinOffice = this.isWithinOfficeRadius(lat, lng);
        const distance = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
        
        if (withinOffice) {
            sessionStorage.setItem('loggedInEmployee', JSON.stringify(employee));
            this.markAttendance(employee.id, lat, lng, 'auto');
            return { 
                success: true, 
                employee: employee, 
                withinOffice: true,
                distance: distance,
                message: '✅ Logged in from office. Attendance marked.'
            };
        } else {
            const requestId = this.createLoginRequest(employee.id, lat, lng);
            return {
                success: false,
                withinOffice: false,
                requestId: requestId,
                employee: employee,
                distance: distance,
                message: `⚠️ You are ${(distance * 1000).toFixed(0)} meters from office. Request sent to Admin.`
            };
        }
    },
    
    getLoggedInEmployee() {
        try {
            const data = sessionStorage.getItem('loggedInEmployee');
            return data ? JSON.parse(data) : null;
        } catch(e) {
            return null;
        }
    },
    
    logoutEmployee() {
        sessionStorage.removeItem('loggedInEmployee');
        return true;
    },
    
    // ============================================
    // LOGIN REQUEST SYSTEM
    // ============================================
    
    createLoginRequest(employeeId, lat, lng) {
        const requests = this.getLoginRequests();
        const employee = this.getEmployeeById(employeeId);
        
        const request = {
            id: 'REQ-' + Date.now(),
            employeeId: employeeId,
            employeeName: employee ? employee.name : 'Unknown',
            lat: lat,
            lng: lng,
            timestamp: new Date().toISOString(),
            status: 'pending',
            approvedAt: null,
            approvedBy: null
        };
        requests.push(request);
        this.saveLoginRequests(requests);
        return request.id;
    },
    
    getLoginRequests() {
        try { 
            const data = localStorage.getItem('loginRequests');
            return data ? JSON.parse(data) : []; 
        } catch(e) { 
            console.error('Error loading requests:', e); 
            return []; 
        }
    },
    
    saveLoginRequests(requests) {
        try { 
            localStorage.setItem('loginRequests', JSON.stringify(requests)); 
            return true; 
        } catch(e) { 
            console.error('Error saving requests:', e); 
            return false; 
        }
    },
    
    getPendingLoginRequests() {
        const requests = this.getLoginRequests();
        return requests.filter(r => r.status === 'pending');
    },
    
    approveLoginRequest(requestId) {
        const requests = this.getLoginRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index === -1) return false;
        requests[index].status = 'approved';
        requests[index].approvedAt = new Date().toISOString();
        requests[index].approvedBy = 'Admin';
        this.saveLoginRequests(requests);
        return true;
    },
    
    rejectLoginRequest(requestId) {
        const requests = this.getLoginRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index === -1) return false;
        requests[index].status = 'rejected';
        this.saveLoginRequests(requests);
        return true;
    },
    
    // ============================================
    // ATTENDANCE SYSTEM
    // ============================================
    
    markAttendance(employeeId, lat, lng, type = 'auto') {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        const existing = attendance.find(a => a.employeeId === employeeId && a.date === today);
        if (existing) {
            existing.checkinLat = lat;
            existing.checkinLng = lng;
            existing.checkinType = type;
            this.saveAttendance(attendance);
            return { success: false, message: 'Attendance already marked for today' };
        }
        const employee = this.getEmployeeById(employeeId);
        if (!employee) { return { success: false, message: 'Employee not found' }; }
        const distance = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
        attendance.push({
            employeeId: employeeId,
            employeeName: employee.name,
            date: today,
            loginTime: new Date().toISOString(),
            checkinLat: lat,
            checkinLng: lng,
            distanceFromOffice: distance,
            checkinType: type,
            status: 'present',
            ridesCompleted: 0,
            totalKM: 0,
            customerIds: []
        });
        this.saveAttendance(attendance);
        return { success: true, message: 'Attendance marked successfully' };
    },
    
    getAttendance() {
        try { return JSON.parse(localStorage.getItem('attendance') || '[]'); } 
        catch(e) { console.error('Error loading attendance:', e); return []; }
    },
    
    saveAttendance(attendance) {
        try { localStorage.setItem('attendance', JSON.stringify(attendance)); return true; } 
        catch(e) { console.error('Error saving attendance:', e); return false; }
    },
    
    getTodayAttendance() {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        return attendance.filter(a => a.date === today);
    },
    
    getAttendanceReport(startDate, endDate) {
        const attendance = this.getAttendance();
        return attendance.filter(a => a.date >= startDate && a.date <= endDate);
    },
    
    updateAttendanceRideStats(employeeId, customerId, km) {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        const record = attendance.find(a => a.employeeId === employeeId && a.date === today);
        if (record) {
            record.ridesCompleted = (record.ridesCompleted || 0) + 1;
            record.totalKM = (record.totalKM || 0) + (km || 0);
            if (customerId && !record.customerIds) { record.customerIds = []; }
            if (customerId && !record.customerIds.includes(customerId)) {
                record.customerIds.push(customerId);
            }
            this.saveAttendance(attendance);
            return true;
        }
        return false;
    },
    
    // ============================================
    // RIDE MANAGEMENT (No REF numbers)
    // ============================================
    
    getRides() {
        try { return JSON.parse(localStorage.getItem('rides') || '[]'); } 
        catch(e) { console.error('Error loading rides:', e); return []; }
    },
    
    saveRides(rides) {
        try { 
            localStorage.setItem('rides', JSON.stringify(rides)); 
            window.dispatchEvent(new CustomEvent('ridesUpdated', { detail: { rides } }));
            return true; 
        } catch(e) { console.error('Error saving rides:', e); return false; }
    },
    
    startRideFromCustomerId(employeeId, customerId, lat, lng) {
        const ride = {
            employeeId: employeeId,
            customerId: customerId.trim(),
            status: 'in_progress',
            startTime: new Date().toISOString(),
            startLat: lat,
            startLng: lng,
            endTime: null,
            endLat: null,
            endLng: null,
            totalDistance: 0,
            duration: 0,
            stops: 0,
            locationUpdates: [],
            completed: false
        };
        const rides = this.getRides();
        rides.push(ride);
        this.saveRides(rides);
        return ride;
    },
    
    completeRide(rideIndex, endLat, endLng) {
        const rides = this.getRides();
        const index = rides.findIndex(r => r === rideIndex || r.customerId === rideIndex);
        if (index === -1) return null;
        
        const ride = rides[index];
        ride.status = 'completed';
        ride.completed = true;
        ride.endTime = new Date().toISOString();
        ride.endLat = endLat;
        ride.endLng = endLng;
        
        const start = new Date(ride.startTime);
        const end = new Date(ride.endTime);
        ride.duration = Math.round((end - start) / 1000 / 60);
        
        if (ride.locationUpdates && ride.locationUpdates.length > 1) {
            let totalKM = 0;
            for (let i = 1; i < ride.locationUpdates.length; i++) {
                const prev = ride.locationUpdates[i-1];
                const curr = ride.locationUpdates[i];
                totalKM += this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            }
            ride.totalDistance = Math.round(totalKM * 100) / 100;
        }
        
        this.saveRides(rides);
        this.updateAttendanceRideStats(ride.employeeId, ride.customerId, ride.totalDistance);
        return ride;
    },
    
    getRidesForEmployee(employeeId) {
        const rides = this.getRides();
        return rides.filter(r => r.employeeId === employeeId);
    },
    
    getActiveRidesForEmployee(employeeId) {
        const rides = this.getRides();
        return rides.filter(r => r.employeeId === employeeId && r.status !== 'completed');
    },
    
    updateRideLocation(rideIndex, lat, lng) {
        const rides = this.getRides();
        const index = rides.findIndex(r => r === rideIndex || r.customerId === rideIndex);
        if (index === -1) return false;
        if (!rides[index].locationUpdates) { rides[index].locationUpdates = []; }
        rides[index].locationUpdates.push({ lat: lat, lng: lng, timestamp: new Date().toISOString() });
        this.saveRides(rides);
        this.updateLiveLocation(rideIndex, lat, lng);
        return true;
    },
    
    // ============================================
    // LIVE LOCATION
    // ============================================
    
    getLiveLocations() {
        try { return JSON.parse(localStorage.getItem('liveLocations') || '{}'); } 
        catch(e) { console.error('Error loading live locations:', e); return {}; }
    },
    
    saveLiveLocations(locations) {
        try { 
            localStorage.setItem('liveLocations', JSON.stringify(locations)); 
            window.dispatchEvent(new CustomEvent('locationsUpdated', { detail: { locations } }));
            return true; 
        } catch(e) { console.error('Error saving live locations:', e); return false; }
    },
    
    updateLiveLocation(rideId, lat, lng) {
        if (!rideId || lat === undefined || lng === undefined) {
            console.error('❌ Invalid location data');
            return false;
        }
        const locations = this.getLiveLocations();
        locations[rideId] = { lat: lat, lng: lng, timestamp: new Date().toISOString() };
        this.saveLiveLocations(locations);
        window.dispatchEvent(new CustomEvent('locationUpdate', { detail: { rideId, location: locations[rideId] } }));
        return true;
    },
    
    // ============================================
    // EXCEL EXPORT (Only .xlsx)
    // ============================================
    
    generateExcelReport() {
        const attendance = this.getAttendance();
        const rides = this.getRides();
        const today = new Date().toISOString().split('T')[0];
        
        const todayAttendance = attendance.filter(a => a.date === today);
        const todayRides = rides.filter(r => r.status === 'completed' && r.endTime && new Date(r.endTime).toISOString().split('T')[0] === today);
        
        // Build HTML table for Excel
        let tableRows = '';
        
        if (todayAttendance.length === 0) {
            tableRows = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:20px;color:#6b7280;">No attendance records for today</td>
                </tr>
            `;
        } else {
            todayAttendance.forEach(a => {
                const employeeRides = todayRides.filter(r => r.employeeId === a.employeeId);
                const customerIds = employeeRides.map(r => r.customerId).filter(id => id).join(', ');
                const rideCount = employeeRides.length;
                const totalKM = employeeRides.reduce((sum, r) => sum + (r.totalDistance || 0), 0);
                
                const checkinLocation = `${a.checkinLat ? a.checkinLat.toFixed(6) : 'N/A'}, ${a.checkinLng ? a.checkinLng.toFixed(6) : 'N/A'}`;
                const loginTime = a.loginTime ? new Date(a.loginTime).toLocaleString() : 'N/A';
                const loginType = a.checkinType === 'auto' ? '🏢 Local' : '📱 Remote';
                
                tableRows += `
                    <tr>
                        <td style="border:1px solid #ddd;padding:8px;">${a.employeeName}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${loginTime}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${loginType}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${checkinLocation}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${customerIds || 'None'}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${rideCount}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${totalKM.toFixed(2)} KM</td>
                    </tr>
                `;
            });
        }
        
        const totalRides = todayRides.length;
        const totalKM = todayRides.reduce((sum, r) => sum + (r.totalDistance || 0), 0);
        
        return `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>M Creations - Daily Report</title>
                <!--[if gte mso 9]>
                <xml>
                    <w:WordDocument>
                        <w:View>Print</w:View>
                        <w:Zoom>100</w:Zoom>
                    </w:WordDocument>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; border-bottom: 3px solid #0f3460; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { color: #0f3460; font-size: 28px; margin: 0; }
                    .header h1 span { color: #e94560; }
                    .header .sub { color: #6b7280; font-size: 14px; }
                    .header .brand { color: #0f3460; font-size: 12px; font-weight: bold; }
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
                            <td class="value">${todayAttendance.length}</td>
                            <td class="label">🚗 Total Rides</td>
                            <td class="value">${totalRides}</td>
                        </tr>
                        <tr>
                            <td class="label">📏 Total KM Traveled</td>
                            <td class="value">${totalKM.toFixed(2)} KM</td>
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
                            <td>${totalRides}</td>
                            <td>${totalKM.toFixed(2)} KM</td>
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
    }
};

// Initialize the system
Storage.init();
console.log('🚀 M Creations - Field Tracker Ready');
console.log('📍 Office: Kalaburagi, Karnataka (17.307873, 76.822892)');
console.log('📏 Radius: 100 meters');