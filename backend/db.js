const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'm_creations_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;
let isFallbackMode = false;

// Memory fallback store in case MySQL database is offline or not installed locally
const memoryStore = {
    employees: [
        {
            employee_id: 'EMP001',
            name: 'Emp',
            contact: '9876543210',
            password: 'emp123',
            status: 'available',
            join_date: new Date().toISOString().split('T')[0]
        }
    ],
    rides: [],
    attendance: [],
    login_requests: [],
    employee_locations: {}
};

async function initDB() {
    try {
        // Step 1: Create connection without DB to create DB if needed
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.end();

        // Step 2: Create Pool
        pool = mysql.createPool(config);
        console.log(`✅ Connected to MySQL Database [${config.database}] at ${config.host}:${config.port}`);

        // Step 3: Run schema file or tables setup
        await createTables();
    } catch (err) {
        console.warn(`⚠️ MySQL Connection Warning: ${err.message}`);
        console.warn(`⚠️ Switching backend to resilient in-memory mode. (Connect MySQL for persistent DB storage)`);
        isFallbackMode = true;
    }
}

async function createTables() {
    if (isFallbackMode || !pool) return;
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (e) {
                // Table already exists or minor syntax noise
            }
        }
    }
}

// Distance helper (Haversine formula in KM)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = {
    initDB,
    getPool: () => pool,
    isFallback: () => isFallbackMode,
    memoryStore,
    calculateDistance,
    query: async (sql, params = []) => {
        if (isFallbackMode || !pool) {
            return null; // Signals routes to use memory fallback logic
        }
        return await pool.query(sql, params);
    }
};
