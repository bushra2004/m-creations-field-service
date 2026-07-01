// ============================================
// M CREATIONS AND SERVICES
// Field Service Tracking System
// ============================================

const Storage = {
    init() {
        console.log('🔧 M Creations Service Tracker initialized');
        
        if (!localStorage.getItem('employees')) {
            const employees = [
                { id: 'EMP001', name: 'Rajesh Kumar', contact: '9876543210', status: 'available', joinDate: '2024-01-15' },
                { id: 'EMP002', name: 'Priya Singh', contact: '9876543211', status: 'available', joinDate: '2024-02-01' },
                { id: 'EMP003', name: 'Amit Sharma', contact: '9876543212', status: 'available', joinDate: '2024-03-10' }
            ];
            localStorage.setItem('employees', JSON.stringify(employees));
        }
        
        if (!localStorage.getItem('rides')) {
            localStorage.setItem('rides', JSON.stringify([]));
        }
        
        if (!localStorage.getItem('liveLocations')) {
            localStorage.setItem('liveLocations', JSON.stringify({}));
        }
        
        if (!localStorage.getItem('rideCounter')) {
            localStorage.setItem('rideCounter', '1000');
        }
        
        console.log('✅ M Creations System Ready');
    },
    
    getEmployees() {
        try {
            return JSON.parse(localStorage.getItem('employees') || '[]');
        } catch(e) {
            console.error('Error loading employees:', e);
            return [];
        }
    },
    
    saveEmployees(employees) {
        try {
            localStorage.setItem('employees', JSON.stringify(employees));
            console.log('💾 Employees saved:', employees.length);
            return true;
        } catch(e) {
            console.error('Error saving employees:', e);
            return false;
        }
    },
    
    addEmployee(name, contact) {
        const employees = this.getEmployees();
        const newId = 'EMP' + String(employees.length + 1).padStart(3, '0');
        const newEmployee = {
            id: newId,
            name: name.trim(),
            contact: contact.trim(),
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
            alert('❌ Cannot delete employee with active rides. Please complete or reassign rides first.');
            return false;
        }
        
        employees = employees.filter(e => e.id !== employeeId);
        this.saveEmployees(employees);
        console.log('🗑️ Employee deleted:', employee.name);
        return true;
    },
    
    getRides() {
        try {
            return JSON.parse(localStorage.getItem('rides') || '[]');
        } catch(e) {
            console.error('Error loading rides:', e);
            return [];
        }
    },
    
    saveRides(rides) {
        try {
            localStorage.setItem('rides', JSON.stringify(rides));
            console.log('💾 Rides saved:', rides.length);
            window.dispatchEvent(new CustomEvent('ridesUpdated', { detail: { rides } }));
            return true;
        } catch(e) {
            console.error('Error saving rides:', e);
            return false;
        }
    },
    
    getLiveLocations() {
        try {
            return JSON.parse(localStorage.getItem('liveLocations') || '{}');
        } catch(e) {
            console.error('Error loading locations:', e);
            return {};
        }
    },
    
    saveLiveLocations(locations) {
        try {
            localStorage.setItem('liveLocations', JSON.stringify(locations));
            console.log('💾 Locations saved:', Object.keys(locations).length);
            window.dispatchEvent(new CustomEvent('locationsUpdated', { detail: { locations } }));
            return true;
        } catch(e) {
            console.error('Error saving locations:', e);
            return false;
        }
    },
    
    updateLiveLocation(rideId, lat, lng) {
        if (!rideId || lat === undefined || lng === undefined) {
            console.error('❌ Invalid location data');
            return false;
        }
        
        const locations = this.getLiveLocations();
        locations[rideId] = {
            lat: lat,
            lng: lng,
            timestamp: new Date().toISOString()
        };
        
        this.saveLiveLocations(locations);
        console.log(`📍 Updated ${rideId}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        
        window.dispatchEvent(new CustomEvent('locationUpdate', { 
            detail: { rideId, location: locations[rideId] } 
        }));
        
        return true;
    },
    
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
    
    generateReference() {
        let counter = parseInt(localStorage.getItem('rideCounter') || '1000');
        counter++;
        localStorage.setItem('rideCounter', counter);
        return 'REF-' + counter;
    }
};

Storage.init();
console.log('🚀 M Creations And Services - Field Tracker Ready');
console.log('📌 M Creations Service Excellence');