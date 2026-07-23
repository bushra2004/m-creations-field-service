// ============================================
// M CREATIONS - Field Service Tracking System
// Frontend API & Real-time Socket.IO Engine
// ============================================

const API_BASE = window.location.origin.includes('http')
    ? window.location.origin
    : 'http://localhost:5001';

const Storage = {
    // Office Location Configuration (Kalaburagi, Karnataka)
    OFFICE_LAT: 17.307873,
    OFFICE_LNG: 76.822892,
    OFFICE_RADIUS_KM: 0.100, // 100 meters

    socket: null,
    cachedEmployees: [],
    cachedRides: [],
    cachedAttendance: [],
    cachedRequests: [],
    cachedLocations: {},

    init() {
        console.log('🔧 M Creations Service Tracker Initializing...');
        console.log(`📍 Office Location: ${this.OFFICE_LAT}, ${this.OFFICE_LNG}`);
        console.log(`📏 Office Radius: ${this.OFFICE_RADIUS_KM * 1000} meters`);

        // Initialize Socket.IO connection if available
        this.initSocket();

        // Initial Data Fetch
        this.refreshAllData();

        // Background polling fallback every 5s
        setInterval(() => this.refreshAllData(), 5000);
    },

    initSocket() {
        if (typeof io !== 'undefined') {
            try {
                this.socket = io(API_BASE);

                this.socket.on('connect', () => {
                    console.log('⚡ Connected to M Creations Socket.IO Server');

                    if (this.isAdminLoggedIn()) {
                        this.socket.emit('join_admin');
                    }

                    const emp = this.getLoggedInEmployee();
                    if (emp) {
                        this.socket.emit('join_employee', { employeeId: emp.id });
                    }
                });

                // Real-time 2-second location updates from other engineers
                this.socket.on('location_updated', (data) => {
                    if (data && data.employeeId) {
                        const key = data.customerId ? data.customerId : `EMP_${data.employeeId}`;
                        this.cachedLocations[key] = {
                            lat: data.lat,
                            lng: data.lng,
                            employeeId: data.employeeId,
                            timestamp: data.updatedAt || new Date().toISOString()
                        };
                        this.cachedLocations[`EMP_${data.employeeId}`] = {
                            lat: data.lat,
                            lng: data.lng,
                            employeeId: data.employeeId,
                            timestamp: data.updatedAt || new Date().toISOString()
                        };
                        window.dispatchEvent(new CustomEvent('locationUpdate', { detail: { location: data } }));
                    }
                });

                // Real-time remote login request alerts
                this.socket.on('new_login_request', (req) => {
                    console.log('🔔 New Remote Login Request Received:', req);
                    this.refreshRequests();
                    window.dispatchEvent(new CustomEvent('loginRequestAlert', { detail: { request: req } }));
                });

                // Real-time request approval / rejection
                this.socket.on('request_status_changed', (data) => {
                    this.refreshRequests();
                    window.dispatchEvent(new CustomEvent('requestStatusChanged', { detail: data }));
                });

                // Real-time ride updates
                this.socket.on('ride_updated', (data) => {
                    this.refreshRides();
                    window.dispatchEvent(new CustomEvent('ridesUpdated', { detail: data }));
                });

            } catch (e) {
                console.warn('Socket.IO connection notice:', e);
            }
        }
    },

    async refreshAllData() {
        await Promise.all([
            this.refreshEmployees(),
            this.refreshRides(),
            this.refreshLocations(),
            this.refreshRequests()
        ]);
    },

    // ============================================
    // DISTANCE & GEO-FENCING
    // ============================================

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    isWithinOfficeRadius(lat, lng) {
        const dist = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
        return dist <= this.OFFICE_RADIUS_KM;
    },

    // ============================================
    // ADMIN AUTHENTICATION
    // ============================================

    async adminLogin(username, password) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminToken', data.token);
                if (this.socket) this.socket.emit('join_admin');
                return { success: true };
            }
            return { success: false, message: data.message || 'Invalid admin credentials' };
        } catch (e) {
            // Local fallback check
            if (username === 'mohsin' && password === 'mohsin75333') {
                sessionStorage.setItem('adminLoggedIn', 'true');
                return { success: true };
            }
            return { success: false, message: 'Server connection error' };
        }
    },

    isAdminLoggedIn() {
        return sessionStorage.getItem('adminLoggedIn') === 'true';
    },

    adminLogout() {
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminToken');
        return true;
    },

    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================

    async refreshEmployees() {
        try {
            const res = await fetch(`${API_BASE}/api/employees`);
            const data = await res.json();
            if (data.success && Array.isArray(data.employees)) {
                this.cachedEmployees = data.employees;
                localStorage.setItem('employees', JSON.stringify(data.employees));
            }
        } catch (e) {
            try {
                this.cachedEmployees = JSON.parse(localStorage.getItem('employees') || '[]');
            } catch (err) { }
        }
        return this.cachedEmployees;
    },

    getEmployees() {
        this.refreshEmployees();
        return this.cachedEmployees.length > 0
            ? this.cachedEmployees
            : JSON.parse(localStorage.getItem('employees') || '[]');
    },

    getEmployeeByUsername(username) {
        const employees = this.getEmployees();
        return employees.find(e => e.name.toLowerCase() === username.toLowerCase());
    },

    getEmployeeById(id) {
        const employees = this.getEmployees();
        return employees.find(e => e.id === id);
    },

    async addEmployee(name, contact) {
        try {
            const res = await fetch(`${API_BASE}/api/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, contact })
            });
            const data = await res.json();
            if (data.success && data.employee) {
                await this.refreshEmployees();
                return data.employee;
            } else {
                if (data.message) alert(`❌ ${data.message}`);
                return null;
            }
        } catch (e) {
            // Local fallback creation
            const employees = this.getEmployees();
            const newId = 'EMP' + String(employees.length + 1).padStart(3, '0');
            const newEmp = {
                id: newId,
                name: name.trim(),
                contact: contact.trim(),
                password: name.trim().toLowerCase() + '123',
                status: 'available',
                joinDate: new Date().toISOString().split('T')[0]
            };
            employees.push(newEmp);
            localStorage.setItem('employees', JSON.stringify(employees));
            this.cachedEmployees = employees;
            return newEmp;
        }
    },

    async deleteEmployee(employeeId) {
        try {
            const res = await fetch(`${API_BASE}/api/employees/${employeeId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                await this.refreshEmployees();
                return true;
            } else {
                alert(`❌ ${data.message}`);
                return false;
            }
        } catch (e) {
            let employees = this.getEmployees();
            employees = employees.filter(e => e.id !== employeeId);
            localStorage.setItem('employees', JSON.stringify(employees));
            this.cachedEmployees = employees;
            return true;
        }
    },

    // ============================================
    // EMPLOYEE LOGIN & GEO-FENCING
    // ============================================

    async loginEmployee(username, password, lat, lng) {
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, lat, lng })
            });
            const data = await res.json();

            if (data.success && data.withinOffice) {
                sessionStorage.setItem('loggedInEmployee', JSON.stringify(data.employee));
                sessionStorage.setItem('authToken', data.token);
                if (this.socket) this.socket.emit('join_employee', { employeeId: data.employee.id });
                return {
                    success: true,
                    employee: data.employee,
                    withinOffice: true,
                    distance: data.distance,
                    message: data.message
                };
            } else if (!data.withinOffice && data.requestId) {
                return {
                    success: false,
                    withinOffice: false,
                    requestId: data.requestId,
                    employee: data.employee,
                    distance: data.distance,
                    message: data.message
                };
            }
            return { success: false, message: data.message || 'Login failed' };
        } catch (e) {
            // Local fallback geo-fencing calculation
            const employee = this.getEmployeeByUsername(username);
            if (!employee || employee.password !== password) {
                return { success: false, message: 'Invalid credentials' };
            }
            const withinOffice = this.isWithinOfficeRadius(lat, lng);
            const distance = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
            if (withinOffice) {
                sessionStorage.setItem('loggedInEmployee', JSON.stringify(employee));
                this.markAttendance(employee.id, lat, lng, 'auto');
                return { success: true, employee, withinOffice: true, distance, message: 'Logged in from office' };
            } else {
                const reqId = this.createLoginRequest(employee.id, lat, lng);
                return { success: false, withinOffice: false, requestId: reqId, employee, distance, message: 'Remote request sent' };
            }
        }
    },

    getLoggedInEmployee() {
        try {
            const data = sessionStorage.getItem('loggedInEmployee');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    logoutEmployee() {
        sessionStorage.removeItem('loggedInEmployee');
        sessionStorage.removeItem('authToken');
        return true;
    },

    // ============================================
    // LOGIN REQUEST SYSTEM
    // ============================================

    async refreshRequests() {
        try {
            const res = await fetch(`${API_BASE}/api/admin/requests`);
            const data = await res.json();
            if (data.success && Array.isArray(data.requests)) {
                this.cachedRequests = data.requests;
                localStorage.setItem('loginRequests', JSON.stringify(data.requests));
            }
        } catch (e) {
            try {
                this.cachedRequests = JSON.parse(localStorage.getItem('loginRequests') || '[]');
            } catch (err) { }
        }
        return this.cachedRequests;
    },

    getLoginRequests() {
        this.refreshRequests();
        return this.cachedRequests.length > 0
            ? this.cachedRequests
            : JSON.parse(localStorage.getItem('loginRequests') || '[]');
    },

    getPendingLoginRequests() {
        const requests = this.getLoginRequests();
        return requests.filter(r => r.status === 'pending');
    },

    createLoginRequest(employeeId, lat, lng) {
        const reqId = 'REQ-' + Date.now();
        const emp = this.getEmployeeById(employeeId);
        const request = {
            id: reqId,
            employeeId,
            employeeName: emp ? emp.name : 'Unknown',
            lat,
            lng,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        this.cachedRequests.push(request);
        localStorage.setItem('loginRequests', JSON.stringify(this.cachedRequests));
        return reqId;
    },

    async approveLoginRequest(requestId) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/approve`, {
                method: 'PUT'
            });
            const data = await res.json();
            if (data.success) {
                await this.refreshRequests();
                return true;
            }
            return false;
        } catch (e) {
            const index = this.cachedRequests.findIndex(r => r.id === requestId);
            if (index !== -1) {
                this.cachedRequests[index].status = 'approved';
                localStorage.setItem('loginRequests', JSON.stringify(this.cachedRequests));
                return true;
            }
            return false;
        }
    },

    async rejectLoginRequest(requestId) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/reject`, {
                method: 'PUT'
            });
            const data = await res.json();
            if (data.success) {
                await this.refreshRequests();
                return true;
            }
            return false;
        } catch (e) {
            const index = this.cachedRequests.findIndex(r => r.id === requestId);
            if (index !== -1) {
                this.cachedRequests[index].status = 'rejected';
                localStorage.setItem('loginRequests', JSON.stringify(this.cachedRequests));
                return true;
            }
            return false;
        }
    },

    // ============================================
    // ATTENDANCE SYSTEM
    // ============================================

    async getAttendance() {
        try {
            const res = await fetch(`${API_BASE}/api/attendance/all`);
            const data = await res.json();
            if (data.success && Array.isArray(data.attendance)) {
                this.cachedAttendance = data.attendance;
                localStorage.setItem('attendance', JSON.stringify(data.attendance));
            }
        } catch (e) {
            try {
                this.cachedAttendance = JSON.parse(localStorage.getItem('attendance') || '[]');
            } catch (err) { }
        }
        return this.cachedAttendance.length > 0 ? this.cachedAttendance : JSON.parse(localStorage.getItem('attendance') || '[]');
    },

    async getTodayAttendance() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const res = await fetch(`${API_BASE}/api/attendance/${today}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.attendance)) {
                return data.attendance;
            }
        } catch (e) { }

        const all = await this.getAttendance();
        return all.filter(a => a.date === today);
    },

    async getAttendanceReport(startDate, endDate) {
        try {
            const res = await fetch(`${API_BASE}/api/attendance/range/${startDate}/${endDate}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.attendance)) {
                return data.attendance;
            }
        } catch (e) { }

        const all = await this.getAttendance();
        return all.filter(a => a.date >= startDate && a.date <= endDate);
    },

    markAttendance(employeeId, lat, lng, type = 'auto') {
        const today = new Date().toISOString().split('T')[0];
        const attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
        const emp = this.getEmployeeById(employeeId);
        const distance = this.calculateDistance(lat, lng, this.OFFICE_LAT, this.OFFICE_LNG);
        const record = {
            employeeId,
            employeeName: emp ? emp.name : 'Employee',
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
        };
        attendance.push(record);
        localStorage.setItem('attendance', JSON.stringify(attendance));
        return { success: true };
    },

    saveAttendance(attendance) {
        localStorage.setItem('attendance', JSON.stringify(attendance));
        this.cachedAttendance = attendance;
        return true;
    },

    // ============================================
    // RIDE MANAGEMENT & GPS TRACKING
    // ============================================

    async refreshRides() {
        try {
            const res = await fetch(`${API_BASE}/api/rides`);
            const data = await res.json();
            if (data.success && Array.isArray(data.rides)) {
                this.cachedRides = data.rides;
                localStorage.setItem('rides', JSON.stringify(data.rides));
            }
        } catch (e) {
            try {
                this.cachedRides = JSON.parse(localStorage.getItem('rides') || '[]');
            } catch (err) { }
        }
        return this.cachedRides;
    },

    getRides() {
        this.refreshRides();
        return this.cachedRides.length > 0 ? this.cachedRides : JSON.parse(localStorage.getItem('rides') || '[]');
    },

    saveRides(rides) {
        localStorage.setItem('rides', JSON.stringify(rides));
        this.cachedRides = rides;
        return true;
    },

    async startRideFromCustomerId(employeeId, customerId, lat, lng) {
        try {
            const res = await fetch(`${API_BASE}/api/rides/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, customerId, lat, lng })
            });
            const data = await res.json();
            if (data.success && data.ride) {
                await this.refreshRides();
                return data.ride;
            }
        } catch (e) { }

        // Local fallback
        const ride = {
            id: Date.now(),
            employeeId,
            customerId: customerId.trim(),
            status: 'in_progress',
            startTime: new Date().toISOString(),
            startLat: lat,
            startLng: lng,
            endTime: null,
            totalDistance: 0,
            duration: 0,
            locationUpdates: [{ lat, lng, timestamp: new Date().toISOString() }],
            completed: false
        };
        const rides = this.getRides();
        rides.push(ride);
        this.saveRides(rides);
        return ride;
    },

    async completeRide(rideIdentifier, endLat, endLng) {
        try {
            const res = await fetch(`${API_BASE}/api/rides/complete`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: rideIdentifier, endLat, endLng })
            });
            const data = await res.json();
            if (data.success && data.ride) {
                await this.refreshRides();
                return data.ride;
            }
        } catch (e) { }

        // Local fallback completion
        const rides = this.getRides();
        const index = rides.findIndex(r => r.id === rideIdentifier || r.customerId === rideIdentifier);
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
                const prev = ride.locationUpdates[i - 1];
                const curr = ride.locationUpdates[i];
                totalKM += this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            }
            ride.totalDistance = Math.round(totalKM * 100) / 100;
        }

        this.saveRides(rides);
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

    updateRideLocation(rideIdentifier, lat, lng) {
        const emp = this.getLoggedInEmployee();
        const employeeId = emp ? emp.id : null;

        // Send via Socket.IO for 2-second real-time broadcast
        if (this.socket && employeeId) {
            this.socket.emit('location_update', {
                employeeId,
                lat,
                lng,
                customerId: rideIdentifier
            });
        }

        // Send via API endpoint
        if (employeeId) {
            fetch(`${API_BASE}/api/location/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, lat, lng, customerId: rideIdentifier })
            }).catch(() => { });
        }

        // Save local update
        this.updateLiveLocation(rideIdentifier, lat, lng);
        return true;
    },

    // ============================================
    // LIVE LOCATION CACHE
    // ============================================

    async refreshLocations() {
        try {
            const res = await fetch(`${API_BASE}/api/locations`);
            const data = await res.json();
            if (data.success && data.locations) {
                this.cachedLocations = { ...this.cachedLocations, ...data.locations };
                localStorage.setItem('liveLocations', JSON.stringify(this.cachedLocations));
            }
        } catch (e) {
            try {
                this.cachedLocations = JSON.parse(localStorage.getItem('liveLocations') || '{}');
            } catch (err) { }
        }
        return this.cachedLocations;
    },

    getLiveLocations() {
        this.refreshLocations();
        const stored = JSON.parse(localStorage.getItem('liveLocations') || '{}');
        return { ...stored, ...this.cachedLocations };
    },

    updateLiveLocation(rideId, lat, lng) {
        const locations = this.getLiveLocations();
        locations[rideId] = { lat, lng, timestamp: new Date().toISOString() };
        localStorage.setItem('liveLocations', JSON.stringify(locations));
        this.cachedLocations = locations;
        window.dispatchEvent(new CustomEvent('locationUpdate', { detail: { rideId, location: locations[rideId] } }));
        return true;
    },

    // ============================================
    // EXCEL EXPORT REPORT
    // ============================================

    exportExcelFile() {
        window.location.href = `${API_BASE}/api/report/daily`;
    },

    generateExcelReport() {
        this.exportExcelFile();
        return '';
    }
};

// Initialize System Engine
Storage.init();
console.log('🚀 M Creations Field Service API Client Connected');