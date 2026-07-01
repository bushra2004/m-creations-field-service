let currentFilter = 'all';

// Load employees into dropdown
function loadEmployees() {
    const employees = Storage.getEmployees();
    const select = document.getElementById('employeeId');
    if (select) {
        select.innerHTML = '<option value="">Select an employee</option>';
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.todayRides} today)</option>`;
        });
    }
}

// Show create form modal
function showCreateForm() {
    loadEmployees();
    document.getElementById('createModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('createModal').style.display = 'none';
    document.getElementById('requestForm').reset();
}

// Create new service request
document.getElementById('requestForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const referenceId = Storage.generateReference();
    const newRide = {
        id: referenceId,
        customerName: document.getElementById('customerName').value,
        customerMobile: document.getElementById('customerMobile').value,
        customerAddress: document.getElementById('customerAddress').value,
        employeeId: document.getElementById('employeeId').value,
        status: 'assigned',
        startTime: null,
        endTime: null,
        duration: null,
        stops: 0,
        createdAt: new Date().toISOString(),
        trackingLink: `${window.location.origin}/tracking.html?id=${referenceId}`
    };
    
    const rides = Storage.getRides();
    rides.push(newRide);
    Storage.saveRides(rides);
    
    // Update employee stats
    const employees = Storage.getEmployees();
    const employee = employees.find(e => e.id === newRide.employeeId);
    if (employee) {
        employee.todayRides = (employee.todayRides || 0) + 1;
        Storage.updateEmployee(employee.id, { todayRides: employee.todayRides });
    }
    
    alert(`✅ Request created successfully!\n\nReference ID: ${referenceId}\nTracking Link: ${newRide.trackingLink}\n\nShare tracking link with customer.`);
    closeModal();
    loadRides();
    updateStats();
    e.target.reset();
});

// Filter rides
function filterRides(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(filter.replace('_', ' '))) {
            btn.classList.add('active');
        }
    });
    loadRides();
}

// Load all rides
function loadRides() {
    const rides = Storage.getRides();
    const employees = Storage.getEmployees();
    
    let filteredRides = rides;
    if (currentFilter !== 'all') {
        filteredRides = rides.filter(ride => ride.status === currentFilter);
    }
    
    const container = document.getElementById('ridesList');
    if (filteredRides.length === 0) {
        container.innerHTML = '<div class="ride-card"><p style="text-align:center">No rides found</p></div>';
        return;
    }
    
    container.innerHTML = filteredRides.map(ride => {
        const employee = employees.find(e => e.id === ride.employeeId);
        return `
            <div class="ride-card">
                <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap;">
                    <h3><i class="fas fa-ticket-alt"></i> ${ride.id}</h3>
                    ${getStatusBadge(ride.status)}
                </div>
                <div class="ride-info">
                    <p><i class="fas fa-user"></i> <strong>Customer:</strong> ${ride.customerName}</p>
                    <p><i class="fas fa-phone"></i> <strong>Mobile:</strong> ${ride.customerMobile}</p>
                    <p><i class="fas fa-user-check"></i> <strong>Assigned to:</strong> ${employee?.name || 'Unassigned'}</p>
                    <p><i class="fas fa-clock"></i> <strong>Created:</strong> ${formatDate(ride.createdAt)}</p>
                    ${ride.startTime ? `<p><i class="fas fa-play"></i> <strong>Started:</strong> ${formatDate(ride.startTime)}</p>` : ''}
                    ${ride.endTime ? `<p><i class="fas fa-flag-checkered"></i> <strong>Completed:</strong> ${formatDate(ride.endTime)}</p>` : ''}
                    ${ride.duration ? `<p><i class="fas fa-hourglass-half"></i> <strong>Duration:</strong> ${ride.duration} min</p>` : ''}
                </div>
                ${ride.status === 'in_progress' ? 
                    `<div class="location-info" style="margin-top:12px">
                        <i class="fas fa-location-dot"></i> 
                        <strong>Tracking Link:</strong> 
                        <a href="${ride.trackingLink}" target="_blank">${ride.trackingLink}</a>
                    </div>` : ''}
            </div>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    const rides = Storage.getRides();
    const employees = Storage.getEmployees();
    
    const active = rides.filter(r => r.status === 'in_progress').length;
    const todayCompleted = rides.filter(r => {
        if (!r.endTime) return false;
        return new Date(r.endTime).toDateString() === new Date().toDateString();
    }).length;
    const onDuty = employees.filter(e => e.status === 'available').length;
    const todayServices = rides.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length;
    
    const activeEl = document.getElementById('activeCount');
    const completedEl = document.getElementById('completedCount');
    const onDutyEl = document.getElementById('onDutyCount');
    const todayEl = document.getElementById('todayCount');
    
    if (activeEl) activeEl.textContent = active;
    if (completedEl) completedEl.textContent = todayCompleted;
    if (onDutyEl) onDutyEl.textContent = onDuty;
    if (todayEl) todayEl.textContent = todayServices;
}

// Generate report
function generateReport() {
    const rides = Storage.getRides();
    const employees = Storage.getEmployees();
    const reportType = document.getElementById('reportType').value;
    
    let filteredRides = [];
    const now = new Date();
    
    if (reportType === 'daily') {
        filteredRides = rides.filter(r => new Date(r.createdAt).toDateString() === now.toDateString());
    } else if (reportType === 'weekly') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filteredRides = rides.filter(r => new Date(r.createdAt) > weekAgo);
    } else {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filteredRides = rides.filter(r => new Date(r.createdAt) > monthAgo);
    }
    
    const reportHTML = `
        <table class="report-table">
            <thead>
                <tr><th>Employee</th><th>Completed Rides</th><th>Total Time (min)</th><th>Customers Served</th></tr>
            </thead>
            <tbody>
                ${employees.map(emp => {
                    const empRides = filteredRides.filter(r => r.employeeId === emp.id && r.status === 'completed');
                    const totalTime = empRides.reduce((sum, r) => sum + (r.duration || 0), 0);
                    return `
                        <tr>
                            <td><strong>${emp.name}</strong><br><small>${emp.id}</small></td>
                            <td>${empRides.length}</td>
                            <td>${totalTime}</td>
                            <td>${empRides.length}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:#f3f4f6; font-weight:bold">
                    <td>Total</td>
                    <td>${filteredRides.filter(r => r.status === 'completed').length}</td>
                    <td>${filteredRides.reduce((sum, r) => sum + (r.duration || 0), 0)}</td>
                    <td>${filteredRides.filter(r => r.status === 'completed').length}</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    document.getElementById('reportContent').innerHTML = reportHTML;
}

// Export to CSV
function exportToCSV() {
    const rides = Storage.getRides();
    const employees = Storage.getEmployees();
    
    let csv = "Reference ID,Customer Name,Mobile,Employee,Status,Start Time,End Time,Duration (min),Created Date\n";
    
    rides.forEach(ride => {
        const employee = employees.find(e => e.id === ride.employeeId);
        csv += `"${ride.id}","${ride.customerName}","${ride.customerMobile}","${employee?.name || 'N/A'}","${ride.status}","${ride.startTime || ''}","${ride.endTime || ''}","${ride.duration || 0}","${ride.createdAt}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `service-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('✅ Report exported as CSV');
}

// Export to PDF (print version)
function exportToPDF() {
    const reportContent = document.getElementById('reportContent').innerHTML;
    if (!reportContent) {
        alert('Please generate a report first');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Field Service Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                h1 { color: #2563eb; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #2563eb; color: white; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <h1>Field Service Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            ${reportContent}
            <div class="footer">© Field Service Tracking System</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Initialize on page load
if (document.getElementById('ridesList')) {
    loadRides();
    updateStats();
    setInterval(updateStats, 10000);
}