// ============================================
// M CREATIONS
// Field Service Tracking System
// ============================================

const Storage = {
    init() {
        console.log('🔧 M Creations Service Tracker initialized');
        
        if (!localStorage.getItem('employees')) {
            const employees = [
                { id: 'EMP001', name: 'Emp', contact: '9876543210', password: 'emp123', status: 'available', joinDate: '2024-01-15' },
                { id: 'EMP002', name: 'Bandu', contact: '9876543211', password: 'bandu123', status: 'available', joinDate: '2024-02-01' },
                { id: 'EMP003', name: 'Fayaz', contact: '9876543212', password: 'fayaz123', status: 'available', joinDate: '2024-03-10' },
                { id: 'EMP004', name: 'Gouse', contact: '9876543213', password: 'gouse123', status: 'available', joinDate: '2024-03-15' },
                { id: 'EMP005', name: 'Jabbar', contact: '9876543214', password: 'jabbar123', status: 'available', joinDate: '2024-04-01' },
                { id: 'EMP006', name: 'Kalim', contact: '9876543215', password: 'kalim123', status: 'available', joinDate: '2024-04-10' },
                { id: 'EMP007', name: 'Office', contact: '9876543216', password: 'office123', status: 'available', joinDate: '2024-05-01' },
                { id: 'EMP008', name: 'Prasanth', contact: '9876543217', password: 'prasanth123', status: 'available', joinDate: '2024-05-15' },
                { id: 'EMP009', name: 'Praveen', contact: '9876543218', password: 'praveen123', status: 'available', joinDate: '2024-06-01' },
                { id: 'EMP010', name: 'Sharanayya', contact: '9876543219', password: 'sharanayya123', status: 'available', joinDate: '2024-06-15' },
                { id: 'EMP011', name: 'Waheed', contact: '9876543220', password: 'waheed123', status: 'available', joinDate: '2024-07-01' }
            ];
            localStorage.setItem('employees', JSON.stringify(employees));
        }
        
        if (!localStorage.getItem('rides')) { localStorage.setItem('rides', JSON.stringify([])); }
        if (!localStorage.getItem('liveLocations')) { localStorage.setItem('liveLocations', JSON.stringify({})); }
        if (!localStorage.getItem('rideCounter')) { localStorage.setItem('rideCounter', '1000'); }
        if (!localStorage.getItem('attendance')) { localStorage.setItem('attendance', JSON.stringify([])); }
        
        console.log('✅ M Creations System Ready');
    },
    
    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================
    
    getEmployees() {
        try { return JSON.parse(localStorage.getItem('employees') || '[]'); } 
        catch(e) { console.error('Error loading employees:', e); return []; }
    },
    
    saveEmployees(employees) {
        try { localStorage.setItem('employees', JSON.stringify(employees)); console.log('💾 Employees saved:', employees.length); return true; } 
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
    
    loginEmployee(username, password) {
        const employee = this.getEmployeeByUsername(username);
        if (!employee) { return { success: false, message: 'Employee not found' }; }
        if (employee.password === password) {
            sessionStorage.setItem('loggedInEmployee', JSON.stringify(employee));
            return { success: true, employee: employee };
        }
        return { success: false, message: 'Incorrect password' };
    },
    
    getLoggedInEmployee() {
        try { const data = sessionStorage.getItem('loggedInEmployee'); return data ? JSON.parse(data) : null; } 
        catch(e) { return null; }
    },
    
    logoutEmployee() { sessionStorage.removeItem('loggedInEmployee'); return true; },
    
    addEmployee(name, contact, password) {
        const employees = this.getEmployees();
        const newId = 'EMP' + String(employees.length + 1).padStart(3, '0');
        const newEmployee = {
            id: newId,
            name: name.trim(),
            contact: contact.trim(),
            password: password || name.trim().toLowerCase() + '123',
            status: 'available',
            joinDate: new Date().toISOString().split('T')[0]
        };
        employees.push(newEmployee);
        this.saveEmployees(employees);
        console.log('✅ Employee added:', newEmployee);
        return newEmployee;
    },
    
    updateEmployeePassword(employeeId, newPassword) {
        const employees = this.getEmployees();
        const index = employees.findIndex(e => e.id === employeeId);
        if (index === -1) return false;
        employees[index].password = newPassword;
        this.saveEmployees(employees);
        console.log(`🔑 Password updated for ${employees[index].name}`);
        return true;
    },
    
    deleteEmployee(employeeId) {
        let employees = this.getEmployees();
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return false;
        const rides = this.getRides();
        const hasActiveRide = rides.some(r => r.employeeId === employeeId && r.status !== 'completed');
        if (hasActiveRide) {
            alert('❌ Cannot delete employee with active rides. Please complete or reassign rides first.');
            return false;
        }
        employees = employees.filter(e => e.id !== employeeId);
        this.saveEmployees(employees);
        console.log('🗑️ Employee deleted:', employee.name);
        return true;
    },
    
    // ============================================
    // RIDE MANAGEMENT
    // ============================================
    
    getRides() {
        try { return JSON.parse(localStorage.getItem('rides') || '[]'); } 
        catch(e) { console.error('Error loading rides:', e); return []; }
    },
    
    saveRides(rides) {
        try { 
            localStorage.setItem('rides', JSON.stringify(rides)); 
            console.log('💾 Rides saved:', rides.length); 
            window.dispatchEvent(new CustomEvent('ridesUpdated', { detail: { rides } }));
            return true; 
        } catch(e) { console.error('Error saving rides:', e); return false; }
    },
    
    getRidesForEmployee(employeeId) {
        const rides = this.getRides();
        return rides.filter(r => r.employeeId === employeeId);
    },
    
    getActiveRidesForEmployee(employeeId) {
        const rides = this.getRides();
        return rides.filter(r => r.employeeId === employeeId && r.status !== 'completed');
    },
    
    // ============================================
    // LOCATION MANAGEMENT
    // ============================================
    
    getLiveLocations() {
        try { return JSON.parse(localStorage.getItem('liveLocations') || '{}'); } 
        catch(e) { console.error('Error loading locations:', e); return {}; }
    },
    
    saveLiveLocations(locations) {
        try { 
            localStorage.setItem('liveLocations', JSON.stringify(locations)); 
            console.log('💾 Locations saved:', Object.keys(locations).length); 
            window.dispatchEvent(new CustomEvent('locationsUpdated', { detail: { locations } }));
            return true; 
        } catch(e) { console.error('Error saving locations:', e); return false; }
    },
    
    updateLiveLocation(rideId, lat, lng) {
        if (!rideId || lat === undefined || lng === undefined) {
            console.error('❌ Invalid location data');
            return false;
        }
        const locations = this.getLiveLocations();
        locations[rideId] = { lat: lat, lng: lng, timestamp: new Date().toISOString() };
        this.saveLiveLocations(locations);
        console.log(`📍 Updated ${rideId}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        window.dispatchEvent(new CustomEvent('locationUpdate', { detail: { rideId, location: locations[rideId] } }));
        return true;
    },
    
    // ============================================
    // DISTANCE CALCULATION
    // ============================================
    
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
    
    // ============================================
    // REFERENCE GENERATION
    // ============================================
    
    generateReference() {
        let counter = parseInt(localStorage.getItem('rideCounter') || '1000');
        counter++;
        localStorage.setItem('rideCounter', counter);
        return 'REF-' + counter;
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
    
    isAdminLoggedIn() { return sessionStorage.getItem('adminLoggedIn') === 'true'; },
    adminLogout() { sessionStorage.removeItem('adminLoggedIn'); return true; },
    
    // ============================================
    // ATTENDANCE SYSTEM
    // ============================================
    
    markAttendance(employeeId) {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        const existing = attendance.find(a => a.employeeId === employeeId && a.date === today);
        if (existing) { return { success: false, message: 'Attendance already marked for today' }; }
        const employee = this.getEmployeeById(employeeId);
        if (!employee) { return { success: false, message: 'Employee not found' }; }
        attendance.push({
            employeeId: employeeId,
            employeeName: employee.name,
            date: today,
            loginTime: new Date().toISOString(),
            status: 'present',
            ridesCompleted: 0,
            totalKM: 0
        });
        this.saveAttendance(attendance);
        console.log(`✅ Attendance marked for ${employee.name} on ${today}`);
        return { success: true, message: 'Attendance marked successfully' };
    },
    
    getAttendance() {
        try { return JSON.parse(localStorage.getItem('attendance') || '[]'); } 
        catch(e) { console.error('Error loading attendance:', e); return []; }
    },
    
    saveAttendance(attendance) {
        try { localStorage.setItem('attendance', JSON.stringify(attendance)); console.log('💾 Attendance saved:', attendance.length); return true; } 
        catch(e) { console.error('Error saving attendance:', e); return false; }
    },
    
    getTodayAttendance() {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        return attendance.filter(a => a.date === today);
    },
    
    getAttendanceByDate(date) {
        const attendance = this.getAttendance();
        return attendance.filter(a => a.date === date);
    },
    
    getAttendanceReport(startDate, endDate) {
        const attendance = this.getAttendance();
        return attendance.filter(a => a.date >= startDate && a.date <= endDate);
    },
    
    updateAttendanceRideStats(employeeId, km) {
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAttendance();
        const record = attendance.find(a => a.employeeId === employeeId && a.date === today);
        if (record) {
            record.ridesCompleted = (record.ridesCompleted || 0) + 1;
            record.totalKM = (record.totalKM || 0) + (km || 0);
            this.saveAttendance(attendance);
            return true;
        }
        return false;
    },
    
    getAttendanceSummary() {
        const attendance = this.getAttendance();
        const summary = {};
        attendance.forEach(a => {
            if (!summary[a.date]) { summary[a.date] = { date: a.date, present: 0, absent: 0, totalEmployees: 0 }; }
            if (a.status === 'present') { summary[a.date].present++; }
            summary[a.date].totalEmployees++;
        });
        return Object.values(summary).sort((a, b) => a.date.localeCompare(b.date));
    }
};

Storage.init();
console.log('🚀 M Creations - Field Tracker Ready');
console.log('👑 Admin: mohsin / mohsin75333');
console.log('📌 Employee default passwords: name + "123"');
console.log('📋 Attendance tracking active');