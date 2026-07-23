-- ============================================
-- M CREATIONS - Field Service Tracking System
-- Database Schema (MySQL)
-- ============================================

CREATE DATABASE IF NOT EXISTS `m_creations_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `m_creations_db`;

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS `employees` (
    `employee_id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `contact` VARCHAR(20) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'available',
    `join_date` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Rides Table
CREATE TABLE IF NOT EXISTS `rides` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` VARCHAR(100) NOT NULL,
    `employee_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME NULL,
    `start_lat` DOUBLE NOT NULL,
    `start_lng` DOUBLE NOT NULL,
    `end_lat` DOUBLE NULL,
    `end_lng` DOUBLE NULL,
    `total_distance` DOUBLE DEFAULT 0,
    `duration` INT DEFAULT 0,
    `location_updates` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Attendance Table
CREATE TABLE IF NOT EXISTS `attendance` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` VARCHAR(50) NOT NULL,
    `employee_name` VARCHAR(100) NOT NULL,
    `date` DATE NOT NULL,
    `login_time` DATETIME NOT NULL,
    `checkin_lat` DOUBLE NOT NULL,
    `checkin_lng` DOUBLE NOT NULL,
    `distance_from_office` DOUBLE NOT NULL,
    `checkin_type` VARCHAR(50) NOT NULL DEFAULT 'auto',
    `status` VARCHAR(20) NOT NULL DEFAULT 'present',
    `rides_completed` INT DEFAULT 0,
    `total_km` DOUBLE DEFAULT 0,
    `customer_ids` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_emp_date` (`employee_id`, `date`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Login Requests Table
CREATE TABLE IF NOT EXISTS `login_requests` (
    `request_id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `employee_id` VARCHAR(50) NOT NULL,
    `employee_name` VARCHAR(100) NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `request_time` DATETIME NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `approved_at` DATETIME NULL,
    `approved_by` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Employee Locations Table (Live Tracking)
CREATE TABLE IF NOT EXISTS `employee_locations` (
    `employee_id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `updated_at` DATETIME NOT NULL,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Seed Data (Optional Admin test user / demo employee)
INSERT IGNORE INTO `employees` (`employee_id`, `name`, `contact`, `password`, `status`, `join_date`)
VALUES 
('EMP001', 'Emp', '9876543210', 'emp123', 'available', CURDATE());
