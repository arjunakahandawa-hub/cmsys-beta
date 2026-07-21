-- =============================================
-- NCW-PS Database Schema
-- Naval Civil Works Productivity Suite
-- Version 2.0.0
-- =============================================

CREATE DATABASE IF NOT EXISTS ncw_ps_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ncw_ps_db;

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    official_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    rank VARCHAR(50),
    trade VARCHAR(50) COMMENT 'MA, CA, PA, PL, BB, RW, WE, AL, SW',
    category ENUM('Regular', 'VSS') NOT NULL DEFAULT 'Regular',
    zone_assigned VARCHAR(50),
    role ENUM('Command', 'OIC', 'Supervisor', 'Sailor') DEFAULT 'Sailor',
    contact_number VARCHAR(20),
    email VARCHAR(100),
    date_of_joining DATE,
    status ENUM('Active', 'Inactive', 'Transferred', 'Leave', 'Sick', 'TempDraft') DEFAULT 'Active',
    performance_score DECIMAL(3,2) DEFAULT 5.00,
    profile_image_url VARCHAR(500),
    firebase_uid VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_zone (zone_assigned),
    INDEX idx_trade (trade),
    INDEX idx_status (status)
);

-- =============================================
-- LOCATIONS TABLE
-- =============================================
CREATE TABLE locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id VARCHAR(50) NOT NULL,
    building_name VARCHAR(200) NOT NULL,
    sub_location VARCHAR(200),
    description TEXT,
    gps_coordinates VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_zone (zone_id),
    INDEX idx_building (building_name)
);

-- =============================================
-- WORK ORDERS TABLE
-- =============================================
CREATE TABLE work_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id VARCHAR(50) NOT NULL,
    type ENUM('PROJECT', 'JOB', 'TASK') NOT NULL,
    reference_no VARCHAR(100) COMMENT 'Minute Sheet / Job Card No / Signal No',
    reference_type ENUM('Minute Sheet', 'Signal', 'Letter', 'Verbal') DEFAULT 'Minute Sheet',
    description TEXT NOT NULL,
    status ENUM('Pending', 'Active', 'Hold', 'Completed', 'Cancelled') DEFAULT 'Pending',
    priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    estimated_duration INT COMMENT 'Duration in days',
    budget_allocation DECIMAL(12,2),
    authority_approval VARCHAR(200),
    incharge_id INT REFERENCES users(id),
    supervisor_id INT REFERENCES users(id),
    location_id INT REFERENCES locations(id),
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_zone_status (zone_id, status),
    INDEX idx_type (type),
    INDEX idx_priority (priority)
);

-- =============================================
-- JOB CARDS TABLE
-- =============================================
CREATE TABLE job_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_number VARCHAR(50) UNIQUE NOT NULL,
    work_order_id INT REFERENCES work_orders(id),
    zone_id VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(200),
    location_id INT REFERENCES locations(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status ENUM('Active', 'Completed', 'Cancelled', 'OnHold') DEFAULT 'Active',
    total_material_cost DECIMAL(12,2) DEFAULT 0,
    total_labor_hours DECIMAL(10,2) DEFAULT 0,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_number (job_number),
    INDEX idx_zone (zone_id),
    INDEX idx_status (status)
);

-- =============================================
-- JOB CARD MATERIALS (Material Log)
-- =============================================
CREATE TABLE job_card_materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_card_id INT NOT NULL REFERENCES job_cards(id),
    material_id INT REFERENCES inventory(id),
    material_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    cost_per_unit DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    logged_by INT REFERENCES users(id),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    INDEX idx_job_card (job_card_id),
    INDEX idx_material (material_id)
);

-- =============================================
-- JOB CARD LABOR (Labor Log)
-- =============================================
CREATE TABLE job_card_labor (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_card_id INT NOT NULL REFERENCES job_cards(id),
    sailor_id INT NOT NULL REFERENCES users(id),
    work_date DATE NOT NULL,
    hours_worked DECIMAL(4,2) DEFAULT 8.00,
    role VARCHAR(100),
    task_description TEXT,
    logged_by INT REFERENCES users(id),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_card (job_card_id),
    INDEX idx_sailor (sailor_id),
    INDEX idx_date (work_date)
);

-- =============================================
-- INVENTORY TABLE (Materials & Tools)
-- =============================================
CREATE TABLE inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category ENUM('BMS', 'Plumbing', 'Metal', 'General', 'Aluminium', 'Paint', 'Electrical', 'Tools') NOT NULL DEFAULT 'General',
    description VARCHAR(300) NOT NULL,
    deno VARCHAR(50) NOT NULL COMMENT 'Unit type: nos, Ltr, meters, kg, etc',
    quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost_per_unit DECIMAL(12,2) NOT NULL COMMENT 'Rs Inclusive VAT',
    requirement VARCHAR(200) COMMENT 'Project name or General',
    location VARCHAR(200) DEFAULT 'Zone Store' COMMENT 'Respective Zone, project, or store location',
    book_no VARCHAR(100) COMMENT 'Stock Book number / reference',
    on_charge_ref VARCHAR(100) COMMENT 'Nav 254, Nav 255 references',
    off_charge_ref VARCHAR(100) COMMENT 'Job card number, Nav 254',
    min_stock_level DECIMAL(10,2) DEFAULT 0,
    date_added DATE NOT NULL,
    last_restocked DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_description (description),
    INDEX idx_location (location),
    INDEX idx_book_no (book_no)
);

-- =============================================
-- INVENTORY ON-CHARGE RECORDS
-- =============================================
CREATE TABLE inventory_on_charge (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL REFERENCES inventory(id),
    on_charge_ref VARCHAR(100) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    date_received DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory (inventory_id)
);

-- =============================================
-- USER FEEDBACK TABLE
-- =============================================
CREATE TABLE user_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_number VARCHAR(50) NOT NULL,
    job_card_id INT REFERENCES job_cards(id),
    productivity_score INT NOT NULL CHECK (productivity_score >= 1 AND productivity_score <= 5),
    workmanship_score INT NOT NULL CHECK (workmanship_score >= 1 AND workmanship_score <= 5),
    communication_score INT NOT NULL CHECK (communication_score >= 1 AND communication_score <= 5),
    professionalism_score INT NOT NULL CHECK (professionalism_score >= 1 AND professionalism_score <= 5),
    satisfaction_score INT NOT NULL CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    overall_score DECIMAL(3,2),
    comments TEXT,
    submitted_by VARCHAR(200),
    contact_info VARCHAR(200),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_number (job_number),
    INDEX idx_overall_score (overall_score)
);

-- =============================================
-- FEEDBACK TOKENS TABLE
-- =============================================
CREATE TABLE feedback_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_number VARCHAR(50) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token)
);

-- =============================================
-- ESTIMATES TABLE
-- =============================================
CREATE TABLE estimates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    estimate_number VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    reference_doc VARCHAR(200),
    total_cost DECIMAL(12,2) DEFAULT 0,
    status ENUM('Pending', 'Approved', 'Rejected', 'Revised') DEFAULT 'Pending',
    created_by INT REFERENCES users(id),
    approved_by INT REFERENCES users(id),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
);

-- =============================================
-- ESTIMATE ITEMS TABLE
-- =============================================
CREATE TABLE estimate_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    estimate_id INT NOT NULL REFERENCES estimates(id),
    material_id INT REFERENCES inventory(id),
    description VARCHAR(300) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    availability ENUM('Zone Store', 'Ready Use Store', 'Balance Store', 'To Purchase', 'Unknown') DEFAULT 'Unknown',
    INDEX idx_estimate (estimate_id)
);

-- =============================================
-- MAINTENANCE RECORDS TABLE
-- =============================================
CREATE TABLE maintenance_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    location_id INT NOT NULL REFERENCES locations(id),
    job_card_id INT REFERENCES job_cards(id),
    maintenance_type ENUM('Repair', 'Preventive', 'Emergency', 'Routine', 'Upgrade') NOT NULL,
    description TEXT NOT NULL,
    maintenance_date DATE NOT NULL,
    performed_by INT REFERENCES users(id),
    next_maintenance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_location (location_id),
    INDEX idx_date (maintenance_date)
);

-- =============================================
-- ZONE TEAMS TABLE
-- =============================================
CREATE TABLE zone_teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id VARCHAR(50) NOT NULL,
    sailor_id INT NOT NULL REFERENCES users(id),
    assigned_by INT REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Active', 'Inactive', 'TempDraft') DEFAULT 'Active',
    UNIQUE KEY unique_zone_sailor (zone_id, sailor_id),
    INDEX idx_zone (zone_id),
    INDEX idx_status (status)
);

-- =============================================
-- DAILY ALLOCATIONS TABLE
-- =============================================
CREATE TABLE daily_allocations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    sailor_id INT NOT NULL REFERENCES users(id),
    work_order_id INT NOT NULL REFERENCES work_orders(id),
    role_today VARCHAR(100),
    assigned_by INT REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Active', 'Completed', 'Reassigned', 'Absent') DEFAULT 'Active',
    is_continuation BOOLEAN DEFAULT FALSE,
    UNIQUE KEY unique_daily_assignment (date, sailor_id),
    INDEX idx_date (date),
    INDEX idx_work_order (work_order_id)
);

-- =============================================
-- DAILY EVALUATIONS TABLE (Extended 1-10 Scale)
-- =============================================
CREATE TABLE daily_evaluations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    sailor_id INT NOT NULL REFERENCES users(id),
    supervisor_id INT NOT NULL REFERENCES users(id),
    work_order_id INT REFERENCES work_orders(id),
    job_card_id INT REFERENCES job_cards(id),
    quality_score INT NOT NULL CHECK (quality_score >= 1 AND quality_score <= 10),
    efficiency_score INT NOT NULL CHECK (efficiency_score >= 1 AND efficiency_score <= 10),
    discipline_score INT NOT NULL CHECK (discipline_score >= 1 AND discipline_score <= 10),
    material_score INT NOT NULL CHECK (material_score >= 1 AND material_score <= 10),
    attitude_score INT NOT NULL CHECK (attitude_score >= 1 AND attitude_score <= 10),
    skill_score INT NOT NULL CHECK (skill_score >= 1 AND skill_score <= 10),
    comment TEXT,
    score_1_reason TEXT COMMENT 'Required for score 1',
    score_2_reason TEXT COMMENT 'Required for score 2',
    score_10_reason TEXT COMMENT 'Required for score 10',
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_daily_eval (date, sailor_id, work_order_id),
    INDEX idx_sailor (sailor_id),
    INDEX idx_date (date)
);

-- =============================================
-- ATTENDANCE LOG TABLE
-- =============================================
CREATE TABLE attendance_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    sailor_id INT NOT NULL REFERENCES users(id),
    status ENUM('Present', 'Leave', 'Sick', 'TempDraft', 'Duty', 'Training') NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    logged_by INT REFERENCES users(id),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_daily_attendance (date, sailor_id),
    INDEX idx_date_status (date, status)
);

-- =============================================
-- AUDIT LOG TABLE
-- =============================================
CREATE TABLE audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    user_id INT REFERENCES users(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_user (user_id)
);

-- =============================================
-- APPROVED PENDING JOBS TABLE (For Dropdown)
-- =============================================
CREATE TABLE approved_pending_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reference_no VARCHAR(100) NOT NULL,
    reference_type ENUM('Minute Sheet', 'Signal', 'Letter') NOT NULL,
    description TEXT NOT NULL,
    authority VARCHAR(200),
    estimated_cost DECIMAL(12,2),
    approved_date DATE,
    status ENUM('Pending', 'InProgress', 'Completed') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status)
);

-- =============================================
-- SAMPLE DATA INSERT
-- =============================================

-- Insert sample users
INSERT INTO users (official_number, name, rank, trade, category, zone_assigned, role, performance_score) VALUES
('MA/1234', 'AB Kamal Perera', 'AB', 'MA', 'Regular', 'A-Zone', 'Sailor', 7.50),
('CA/2345', 'LS Nimal Silva', 'LS', 'CA', 'Regular', 'A-Zone', 'Sailor', 8.20),
('PA/3456', 'AB Sunil Fernando', 'AB', 'PA', 'VSS', 'A-Zone', 'Sailor', 6.80),
('PL/4567', 'PO2 Chamara Bandara', 'PO2', 'PL', 'Regular', 'A-Zone', 'Supervisor', 8.50),
('WE/5678', 'AB Ruwan Jayasena', 'AB', 'WE', 'Regular', 'BC-Zone', 'Sailor', 7.20),
('MA/6789', 'LS Pradeep Kumara', 'LS', 'MA', 'VSS', 'BC-Zone', 'Sailor', 7.80),
('CA/7890', 'AB Lasith Malinga', 'AB', 'CA', 'Regular', 'A-Zone', 'Sailor', 8.00),
('RW/8901', 'PO1 Dinesh Priyantha', 'PO1', 'RW', 'Regular', 'A-Zone', 'Supervisor', 9.10),
('PA/9012', 'AB Sampath Kumara', 'AB', 'PA', 'Regular', 'Carpentry-Shop', 'Sailor', 7.40),
('MA/0123', 'LS Gayan Wickrama', 'LS', 'MA', 'Regular', 'Welding-Shop', 'Sailor', 6.90);

-- Insert sample locations
INSERT INTO locations (zone_id, building_name, sub_location, description) VALUES
('A-Zone', 'Wardroom Building', 'Ground Floor', 'Officers Wardroom'),
('A-Zone', 'Wardroom Building', 'First Floor', 'Officers Quarters'),
('A-Zone', 'Jetty B', 'Main Pier', 'Main jetty structure'),
('A-Zone', 'Workshop A', 'Main Hall', 'Main workshop area'),
('BC-Zone', 'Quarters Block C', 'All Floors', 'Sailors quarters'),
('BC-Zone', 'Store Building', 'Ground Floor', 'Main stores'),
('Carpentry-Shop', 'Carpentry Workshop', 'Main Area', 'Woodworking shop'),
('Welding-Shop', 'Welding Workshop', 'Bay 1', 'Metal fabrication');

-- Insert sample inventory
INSERT INTO inventory (type, description, deno, quantity, cost_per_unit, requirement, location, on_charge_ref) VALUES
('material', 'Portland Cement 50kg', 'bags', 150, 1850.00, 'both', 'Zone Store', 'Nav254/2024/001'),
('material', 'River Sand', 'cubic meters', 25, 12500.00, 'both', 'Zone Store', 'Nav254/2024/002'),
('material', '2x4 Timber Treated', 'meters', 200, 450.00, 'project', 'Ready Use Store', 'Nav254/2024/003'),
('material', 'Ready Mix Concrete', 'cubic meters', 10, 18500.00, 'project', 'Zone Store', 'Nav254/2024/004'),
('material', 'PVC Pipe 4 inch', 'meters', 100, 850.00, 'maintenance', 'Ready Use Store', 'Nav254/2024/005'),
('material', 'Electrical Cable 2.5mm', 'meters', 500, 125.00, 'both', 'Zone Store', 'Nav254/2024/006'),
('tool', 'Drill Machine Bosch', 'nos', 5, 45000.00, 'both', 'Workshop', 'Nav255/2024/001'),
('tool', 'Angle Grinder', 'nos', 3, 28000.00, 'both', 'Workshop', 'Nav255/2024/002'),
('tool', 'Welding Machine 400A', 'nos', 2, 125000.00, 'both', 'Workshop', 'Nav255/2024/003');

-- Insert approved pending jobs
INSERT INTO approved_pending_jobs (reference_no, reference_type, description, authority, estimated_cost, approved_date) VALUES
('MS/NCW/2024/001', 'Minute Sheet', 'Wardroom Construction Phase 2', 'CCED(E)', 2500000.00, '2024-01-15'),
('MS/NCW/2024/002', 'Minute Sheet', 'Workshop Building Foundation', 'CCEO(E)', 1800000.00, '2024-01-20'),
('SIG/NCW/2024/015', 'Signal', 'Emergency Jetty Repair', 'CO NHQ', 500000.00, '2024-02-01'),
('MS/NCW/2024/005', 'Minute Sheet', 'Quarters Block Renovation', 'CCED(E)', 3200000.00, '2024-02-10');
