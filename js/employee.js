let currentEmployee = null;
let activeRide = null;
let watchId = null;
let locationUpdateInterval = null;

// Load employee list
function loadEmployeeList() {
    const employees = Storage.getEmployees();
    const select = document.getElementById('employeeSelect');
    if (select) {
        select.innerHTML = '<option value="">Choose employee</option>';
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
        });
    }
}

// Select employee
function selectEmployee() {
    const employeeId = document.getElementById('employeeSelect').value;
    if (employeeId) {
        currentEmployee = employeeId;
        const employees = Storage.getEmployees();
        const employee = employees.find(e => e.id === currentEmployee);
        
        document.getElementById('welcomeMessage').innerHTML = `
            <i class="fas fa-smile-wink"></i>
            <h3>Welcome, ${employee?.name}!</h3>
            <p>You have ${getAssignedRidesCount()} assigned rides</p>
        `;
        loadAssignedRides();
        updateStatusIndicator(true);
    } else {
        currentEmployee = null;
        document.getElementById('welcomeMessage').innerHTML = `
            <i class="fas fa-hand-wave"></i>
            <p>Please select your name to see assigned rides</p>
        `;
        document.getElementById('assignedRides').innerHTML = '';
        updateStatusIndicator(false);
    }
}

// Get assigned rides count
function getAssignedRidesCount() {
    const rides = Storage.getRides();
    return rides.filter(ride => ride.employeeId === currentEmployee && ride.status !== 'completed').length;
}

// Load assigned rides
function loadAssignedRides() {
    if (!currentEmployee) return;
    
    const rides = Storage.getRides();
    const assigned = rides.filter(ride => ride.employeeId === currentEmployee && ride.status !== 'completed');
    
    const container = document.getElementById('assignedRides');
    if (assigned.length === 0) {
        container.innerHTML = '<div class="ride-card"><p style="text-align:center">✨ No pending rides. Great job!</p></div>';
        return;
    }
    
    container.innerHTML = '<h3 style="margin-bottom:16px"><i class="fas fa-list"></i> Your Assigned Rides</h3>';
    assigned.forEach(ride => {
        container.innerHTML += `
            <div class="ride-card">
                <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap;">
                    <h3><i class="fas fa-qrcode"></i> ${ride.id}</h3>
                    ${getStatusBadge(ride.status)}
                </div>
                <div class="ride-info">
                    <p><i class="fas fa-user"></i> <strong>Customer:</strong> ${ride.customerName}</p>
                    <p><i class="fas fa-phone"></i> <strong>Mobile:</strong> ${ride.customerMobile}</p>
                    <p><i class="fas fa-location-dot"></i> <strong>Address:</strong> ${ride.customerAddress}</p>
                </div>
                <button onclick="startRide('${ride.id}')" class="btn btn-primary" style="margin-top:12px; width:100%">
                    <i class="fas fa-play"></i> Start Ride
                </button>
            </div>
        `;
    });
}

// Start ride with location tracking
function startRide(rideId) {
    const rides = Storage.getRides();
    const rideIndex = rides.findIndex(r => r.id === rideId);
    
    if (rideIndex !== -1) {
        rides[rideIndex].status = 'in_progress';
        rides[rideIndex].startTime = new Date().toISOString();
        Storage.saveRides(rides);
        
        activeRide = rides[rideIndex];
        
        // Start GPS tracking
        startLocationTracking();
        
        showActiveRide();
        
        // Show tracking link to employee
        alert(`✅ Ride Started!\n\n📱 Share this tracking link with customer:\n${activeRide.trackingLink}\n\n📍 GPS tracking is now active.`);
    }
}

// Start location tracking
function startLocationTracking() {
    if (!navigator.geolocation) {
        document.getElementById('gpsStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> GPS not supported';
        return;
    }
    
    document.getElementById('gpsStatus').innerHTML = '<i class="fas fa-satellite-dish"></i> Acquiring GPS...';
    
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                rideId: activeRide.id,
                employeeId: currentEmployee,
                timestamp: new Date().toISOString(),
                accuracy: position.coords.accuracy
            };
            
            // Save location
            let locations = JSON.parse(localStorage.getItem('liveLocations') || '{}');
            locations[activeRide.id] = location;
            localStorage.setItem('liveLocations', JSON.stringify(locations));
            
            // Update GPS status
            document.getElementById('gpsStatus').innerHTML = `
                <i class="fas fa-check-circle"></i> 
                GPS Active (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})
            `;
        },
        (error) => {
            console.error('GPS Error:', error);
            document.getElementById('gpsStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> GPS unavailable - using last known';
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    
    // Also update every 10 seconds via interval
    locationUpdateInterval = setInterval(() => {
        if (activeRide) {
            navigator.geolocation.getCurrentPosition((position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    rideId: activeRide.id,
                    timestamp: new Date().toISOString()
                };
                let locations = JSON.parse(localStorage.getItem('liveLocations') || '{}');
                locations[activeRide.id] = location;
                localStorage.setItem('liveLocations', JSON.stringify(locations));
            }, () => {});
        }
    }, 10000);
}

// Show active ride interface
function showActiveRide() {
    document.getElementById('assignedRides').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'none';
    const activeDiv = document.getElementById('activeRide');
    activeDiv.style.display = 'block';
    
    activeDiv.innerHTML = `
        <div class="ride-card active">
            <h3><i class="fas fa-truck-fast"></i> Active Service</h3>
            <div class="ride-info">
                <p><i class="fas fa-qrcode"></i> <strong>Reference:</strong> ${activeRide.id}</p>
                <p><i class="fas fa-user"></i> <strong>Customer:</strong> ${activeRide.customerName}</p>
                <p><i class="fas fa-phone"></i> <strong>Mobile:</strong> ${activeRide.customerMobile}</p>
                <p><i class="fas fa-location-dot"></i> <strong>Address:</strong> ${activeRide.customerAddress}</p>
                <p><i class="fas fa-clock"></i> <strong>Started:</strong> ${new Date(activeRide.startTime).toLocaleTimeString()}</p>
            </div>
            <div style="background:#e0f2fe; padding:12px; border-radius:8px; margin:12px 0">
                <i class="fas fa-share-alt"></i>
                <strong>Customer Tracking Link:</strong><br>
                <a href="${activeRide.trackingLink}" target="_blank" style="word-break:break-all; font-size:12px">
                    ${activeRide.trackingLink}
                </a>
            </div>
            <button onclick="endRide()" class="btn btn-success" style="width:100%">
                <i class="fas fa-flag-checkered"></i> Complete Service
            </button>
        </div>
    `;
}

// End ride and calculate stats
function endRide() {
    if (confirm('Have you completed this service?')) {
        const rides = Storage.getRides();
        const rideIndex = rides.findIndex(r => r.id === activeRide.id);
        
        const endTime = new Date();
        const startTime = new Date(rides[rideIndex].startTime);
        const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);
        
        // Count stops from location history
        const locations = JSON.parse(localStorage.getItem('liveLocations') || '{}');
        const rideLocations = Object.values(locations).filter(l => l.rideId === activeRide.id);
        
        rides[rideIndex].status = 'completed';
        rides[rideIndex].endTime = endTime.toISOString();
        rides[rideIndex].duration = durationMinutes;
        rides[rideIndex].stops = rideLocations.length;
        
        Storage.saveRides(rides);
        
        // Stop location tracking
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        if (locationUpdateInterval) {
            clearInterval(locationUpdateInterval);
            locationUpdateInterval = null;
        }
        
        // Update employee stats
        const employees = Storage.getEmployees();
        const employee = employees.find(e => e.id === currentEmployee);
        if (employee) {
            employee.totalRides = (employee.totalRides || 0) + 1;
            Storage.updateEmployee(currentEmployee, { totalRides: employee.totalRides });
        }
        
        alert(`✅ Service Completed!\n\n⏱️ Duration: ${durationMinutes} minutes\n📍 Location updates: ${rideLocations.length}\n👍 Great work!`);
        
        // Reset UI
        activeRide = null;
        document.getElementById('assignedRides').style.display = 'block';
        document.getElementById('welcomeMessage').style.display = 'block';
        document.getElementById('activeRide').style.display = 'none';
        document.getElementById('gpsStatus').innerHTML = '';
        
        loadAssignedRides();
        selectEmployee(); // Refresh welcome message
        updateStatusIndicator(true);
    }
}

// Update status indicator
function updateStatusIndicator(active) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
        if (active) {
            indicator.className = 'status-indicator active';
            indicator.innerHTML = '<i class="fas fa-circle"></i><span>Online - Ready</span>';
        } else {
            indicator.className = 'status-indicator';
            indicator.innerHTML = '<i class="fas fa-circle"></i><span>Offline</span>';
        }
    }
}

// Initialize
if (document.getElementById('employeeSelect')) {
    loadEmployeeList();
}