# 🏢 M Creations - Field Service & Delivery Tracking Backend

Production-ready backend & real-time GPS tracking system for **M Creations** built with Node.js, Express, MySQL, Socket.IO, and JWT authentication.

---

## 📁 Project Structure

```
field-service-app/
├── backend/
│   ├── package.json          # Dependencies (Express, Socket.IO, MySQL2, JWT)
│   ├── server.js            # Main application server & Socket.IO initialization
│   ├── db.js                # Database connection pool & auto-table creation
│   ├── .env                 # Environment variables configuration
│   ├── .env.example         # Environment template
│   └── routes/
│       ├── auth.js          # Admin/Employee login & geo-fencing endpoints
│       ├── employees.js     # Employee management & remote request approval
│       ├── rides.js         # Ride self-assignment & completion
│       ├── attendance.js    # Attendance query & Excel (.xls) report export
│       └── locations.js     # Real-time GPS location updates
├── frontend/
│   ├── index.html           # Landing page
│   ├── admin-login.html     # Protected Admin Login
│   ├── admin.html           # Admin Live Tracking Dashboard & Controls
│   ├── login.html           # Employee Geo-fenced Login page
│   ├── employee.html        # Field Engineer Dashboard & Ride Tracker
│   └── js/
│       └── app.js           # Real-time API & Socket.IO client engine
├── database/
│   └── schema.sql           # MySQL Database table definitions
└── README.md                # Cloud & EC2 Deployment Guide
```

---

## ⚡ Key Features

1. **MySQL Database Engine**: All employees, rides, attendance, remote login requests, and GPS locations stored persistently in MySQL.
2. **Geo-Fencing Login System**:
   - Office Location: **17.307873, 76.822892** (Kalaburagi, Karnataka).
   - Radius: **100 meters**.
   - Within 100m -> Instant auto-login & auto-attendance marked.
   - Outside 100m -> Remote login request sent to Admin dashboard for approval.
3. **2-Second Real-Time Live GPS Tracking**:
   - Uses **Socket.IO** websockets to broadcast live coordinates every 2 seconds to Admin live map.
   - Zero page refresh required.
4. **Ride Management**:
   - Engineers self-assign rides by entering Customer Unique Number.
   - GPS tracks route distance & calculates duration automatically.
5. **Excel Reports**:
   - Daily & custom range attendance & ride reports exported directly as `.xls` spreadsheets.

---

## 🚀 Local Quickstart Guide

### Step 1: Install Dependencies
Navigate into the `backend/` directory and install NPM packages:
```bash
cd backend
npm install
```

### Step 2: Configure Environment (.env)
Create or edit `backend/.env`:
```ini
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=m_creations_db
ADMIN_USERNAME=mohsin
ADMIN_PASSWORD=mohsin75333
JWT_SECRET=m_creations_super_secret_jwt_key_2026
OFFICE_LAT=17.307873
OFFICE_LNG=76.822892
OFFICE_RADIUS_KM=0.100
```

### Step 3: Initialize Database
Import `database/schema.sql` into MySQL:
```bash
mysql -u root -p < ../database/schema.sql
```
*(Note: The server also auto-creates tables if missing upon startup).*

### Step 4: Run the Server
```bash
npm start
```
Access the application at: `http://localhost:5000`

---

## 🌐 AWS EC2 / Cloud Deployment Guide

### Step 1: Connect to your Ubuntu EC2 Instance
```bash
ssh -i "your-key.pem" ubuntu@ec2-your-instance-ip.compute-1.amazonaws.com
```

### Step 2: Install Node.js & MySQL Server
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mysql-server nginx git
```

### Step 3: Secure MySQL & Create Database
```bash
sudo mysql
```
In MySQL console:
```sql
CREATE DATABASE m_creations_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mcreations_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON m_creations_db.* TO 'mcreations_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import schema:
```bash
mysql -u mcreations_user -p m_creations_db < database/schema.sql
```

### Step 4: Setup PM2 Process Manager
Install PM2 globally to keep the Node server running 24/7:
```bash
sudo npm install -g pm2
cd backend
npm install
pm2 start server.js --name "m-creations-backend"
pm2 save
pm2 startup
```

### Step 5: Configure Nginx Reverse Proxy with Socket.IO Support
Edit `/etc/nginx/sites-available/default`:
```nginx
server {
    listen 80;
    server_name yourdomain.com or your-ec2-ip;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Test and restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: SSL / HTTPS Setup (Certbot)
GPS Geolocation APIs require HTTPS on production mobile devices.
```bash
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d yourdomain.com
```

---

## 🔑 Default Credentials

- **Admin Login**:
  - Username: `mohsin`
  - Password: `mohsin75333`
- **Demo Engineer**:
  - Username: `Emp`
  - Password: `emp123`
- **Auto Password Formula for New Employees**:
  - Username: `[employee_name]`
  - Password: `[employee_name_in_lowercase]123` (e.g. Rahul -> `rahul123`)
