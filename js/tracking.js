let refreshInterval = null;

// Track ride by reference number
function trackRide() {
    // Clear any existing refresh interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    
    const trackingId = document.getElementById('trackingId').value.trim();
    if (!trackingId) {
        showError('Please enter a reference number');
        return;
    }
    
    const rides = Storage.getRides();
    const ride = rides.find(r => r.id === trackingId);
    const infoDiv = document.getElementById('trackingInfo');
    
    if (!ride) {
        infoDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Invalid Reference ID. Please check and try again.</p>
                <small>Example format: REF-1001, REF-1002, etc.</small>
            </div>
        `;
        return;
    }
    
    displayTrackingInfo(ride);
    
    // Auto-refresh every 10 seconds for live tracking
    if (ride.status === 'in_progress') {
        refreshInterval = setInterval(() => {
            const updatedRides = Storage.getRides();
            const updatedRide = updatedRides.find(r => r.id === trackingId);
            if (updatedRide) {
                displayTrackingInfo(updatedRide);
            }
        }, 10000);
    }
}

// Display tracking information
function displayTrackingInfo(ride) {
    const employees = Storage.getEmployees();
    const employee = employees.find(e => e.id === ride.employeeId);
    const infoDiv = document.getElementById('trackingInfo');
    
    // Get live location if available
    const locations = JSON.parse(localStorage.getItem('liveLocations') || '{}');
    const lastLocation = locations[ride.id];
    
    let statusIcon = '';
    let statusColor = '';
    let statusMessage = '';
    
    switch(ride.status) {
        case 'assigned':
            statusIcon = 'fa-clock';
            statusColor = '#f59e0b';
            statusMessage = 'Service Assigned - Engineer will arrive soon';
            break;
        case 'in_progress':
            statusIcon = 'fa-truck';
            statusColor = '#10b981';
            statusMessage = 'Engineer is on the way!';
            break;
        case 'completed':
            statusIcon = 'fa-check-circle';
            statusColor = '#10b981';
            statusMessage = 'Service Completed';
            break;
    }
    
    infoDiv.innerHTML = `
        <div class="tracking-details">
            <div style="text-align:center; margin-bottom:20px">
                <i class="fas ${statusIcon}" style="font-size:48px; color:${statusColor}"></i>
                <h3 style="margin-top:10px; color:${statusColor}">${statusMessage}</h3>
            </div>
            
            <p><i class="fas fa-ticket-alt"></i> <strong>Reference Number:</strong> ${ride.id}</p>
            <p><i class="fas fa-user"></i> <strong>Customer:</strong> ${ride.customerName}</p>
            <p><i class="fas fa-user-cog"></i> <strong>Assigned Engineer:</strong> ${employee?.name || 'Being assigned'}</p>
            <p><i class="fas fa-calendar"></i> <strong>Request Date:</strong> ${new Date(ride.createdAt).toLocaleString()}</p>
            
            ${ride.startTime ? `<p><i class="fas fa-play"></i> <strong>Started:</strong> ${new Date(ride.startTime).toLocaleTimeString()}</p>` : ''}
            ${ride.endTime ? `<p><i class="fas fa-flag-checkered"></i> <strong>Completed:</strong> ${new Date(ride.endTime).toLocaleTimeString()}</p>` : ''}
            ${ride.duration ? `<p><i class="fas fa-hourglass-half"></i> <strong>Duration:</strong> ${ride.duration} minutes</p>` : ''}
            
            ${ride.status === 'in_progress' && lastLocation ? `
                <div class="location-info">
                    <h4><i class="fas fa-location-dot"></i> Live Location Update</h4>
                    <p>📍 Last known location:</p>
                    <p><strong>Latitude:</strong> ${lastLocation.lat.toFixed(6)}</p>
                    <p><strong>Longitude:</strong> ${lastLocation.lng.toFixed(6)}</p>
                    <p><small>🕒 Updated: ${new Date(lastLocation.timestamp).toLocaleTimeString()}</small></p>
                    <p class="live"><i class="fas fa-sync-alt"></i> Auto-refreshing every 10 seconds...</p>
                </div>
            ` : ''}
            
            ${ride.status === 'completed' ? `
                <div style="margin-top:16px; padding:12px; background:#dcfce7; border-radius:8px; text-align:center">
                    <i class="fas fa-star" style="color:#f59e0b"></i>
                    <p>Thank you for choosing Samsung Service!</p>
                </div>
            ` : ''}
        </div>
    `;
}

// Show error message
function showError(message) {
    const infoDiv = document.getElementById('trackingInfo');
    infoDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Check URL for direct tracking link
function checkUrlForTrackingId() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
        document.getElementById('trackingId').value = id;
        trackRide();
    }
}

// Initialize on page load
if (document.getElementById('trackingId')) {
    checkUrlForTrackingId();
    
    // Allow Enter key to trigger tracking
    document.getElementById('trackingId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            trackRide();
        }
    });
}