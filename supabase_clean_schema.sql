-- ====================================================================
-- TTP HUB ADMIN DASHBOARD - CLEAN INITIALIZATION SCHEMA
-- Run this script in the SQL Editor of your Supabase Project.
-- This script completely resets the database, creating all modern tables,
-- columns, and relational keys with ZERO mock/seed data.
-- WARNING: This drops existing tables. Use caution in production.
-- ====================================================================

-- 1. CLEANUP EXISTING TABLES (Safe Reset)
DROP TABLE IF EXISTS recent_activities CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teacher_availability CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS system_users CASCADE;
DROP TABLE IF EXISTS billing_transactions CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS group_occupancy CASCADE;

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TEACHERS TABLE
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    specialty VARCHAR(100),
    rate NUMERIC(10, 2) DEFAULT 250.00,
    since DATE DEFAULT CURRENT_DATE,
    birthdate DATE,
    burlington_user VARCHAR(255) DEFAULT '',
    burlington_pass VARCHAR(255) DEFAULT '',
    ttp_user VARCHAR(255) DEFAULT '',
    ttp_pass VARCHAR(255) DEFAULT '',
    completed_hours NUMERIC(10, 2) DEFAULT 0.00,
    max_students INTEGER DEFAULT 20,
    class_types TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'on_leave'))
);

-- 3. CREATE COURSES TABLE
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    level VARCHAR(50) DEFAULT '',
    custom_level VARCHAR(100) DEFAULT '',
    duration_type VARCHAR(20) DEFAULT 'months',
    duration VARCHAR(100) DEFAULT '',
    course_start_date DATE,
    course_end_date DATE,
    price NUMERIC(10,2) DEFAULT 0,
    class_type VARCHAR(50) DEFAULT 'grupal',
    allowed_teachers JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. CREATE GROUPS TABLE
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL,
    course VARCHAR(255) DEFAULT '',
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    schedule VARCHAR(255) DEFAULT '',
    capacity INTEGER DEFAULT 15,
    enrolled INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. CREATE STUDENTS TABLE
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) DEFAULT '',
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'graduated', 'prospect', 'moroso')),
    enrolled_date DATE DEFAULT CURRENT_DATE NOT NULL,
    current_course VARCHAR(255) DEFAULT '',
    current_group VARCHAR(100) DEFAULT '',
    class_type VARCHAR(50) DEFAULT 'grupal' CHECK (class_type IN ('grupal', 'privada', 'conversation_club')),
    schedule VARCHAR(255) DEFAULT '',
    teacher VARCHAR(255) DEFAULT '',
    next_payment DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    phone VARCHAR(50) DEFAULT '',
    birthdate VARCHAR(100) DEFAULT '',
    address VARCHAR(255) DEFAULT '',
    nationality VARCHAR(100) DEFAULT '',
    occupation VARCHAR(100) DEFAULT '',
    amount_due NUMERIC(10, 2) DEFAULT 0.00,
    payment_reference VARCHAR(50) DEFAULT '',
    last_payment_date DATE DEFAULT NULL,
    payment_status VARCHAR(50) DEFAULT 'pendiente' CHECK (payment_status IN ('al_corriente', 'pendiente', 'moroso', 'pago_fallido')),
    suspension_date DATE DEFAULT NULL,
    suspension_reason TEXT DEFAULT NULL,
    course_history JSONB DEFAULT '[]',
    enrollments JSONB DEFAULT '[]',
    admin_notes TEXT DEFAULT '',
    academic_notes TEXT DEFAULT '',
    burlington_user VARCHAR(255) DEFAULT '',
    certificates_issued INTEGER DEFAULT 0,
    status_mode VARCHAR(20) DEFAULT 'auto',
    last_connection_date DATE DEFAULT NULL,
    
    -- Relational UUID Keys
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL
);

-- 6. CREATE SCHEDULES TABLE
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    teacher VARCHAR(255) DEFAULT '',
    group_name VARCHAR(255) DEFAULT '',
    level VARCHAR(100) DEFAULT '',
    daysSelected JSONB DEFAULT '[]',
    slot VARCHAR(10) DEFAULT '08:00',
    startTime VARCHAR(10) DEFAULT '08:00',
    endTime VARCHAR(10) DEFAULT '09:30',
    time VARCHAR(100) DEFAULT '08:00 - 09:30',
    startDate DATE,
    endDate DATE,
    capacity INTEGER DEFAULT 15,
    type VARCHAR(50) DEFAULT 'grupal',
    status VARCHAR(50) DEFAULT 'scheduled',
    meetLink VARCHAR(255) DEFAULT '',
    checkInTime VARCHAR(10) DEFAULT NULL,
    paymentAlert BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. CREATE SYSTEM USERS TABLE
CREATE TABLE system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'Teacher',
    status VARCHAR(20) DEFAULT 'activo',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. CREATE GROUP OCCUPANCY TABLE
CREATE TABLE group_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 15 NOT NULL,
    enrolled_students INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT check_capacity CHECK (enrolled_students <= capacity)
);

-- 9. CREATE BILLING TRANSACTIONS TABLE
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('processed', 'pending', 'overdue')),
    category VARCHAR(100) DEFAULT 'Financial',
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    student_name VARCHAR(255) DEFAULT '',
    type VARCHAR(50) DEFAULT 'payment',
    method VARCHAR(50) DEFAULT 'Efectivo'
);

-- 10. CREATE CLASSES TABLE
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- 11. CREATE TEACHER AVAILABILITY TABLE
CREATE TABLE teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('disponible', 'no_disponible', 'dia_descanso', 'clase_asignada')),
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    description TEXT DEFAULT ''
);

-- 12. CREATE RECENT ACTIVITIES TABLE
CREATE TABLE recent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Academic', 'Financial')),
    status VARCHAR(50) CHECK (status IN ('Completed', 'Processed', 'Alert', 'Archived'))
);

-- 13. CREATE OR REPLACE VIEW dashboard_metrics
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
    (SELECT COUNT(*) FROM students WHERE status = 'active') as active_students,
    (SELECT COUNT(*) FROM students WHERE status = 'active' AND enrolled_date >= date_trunc('month', CURRENT_DATE)) as new_students_this_month,
    COALESCE(ROUND((SELECT SUM(enrolled_students)::NUMERIC / NULLIF(SUM(capacity), 0)::NUMERIC * 100 FROM group_occupancy), 0), 0) as occupancy_rate,
    (SELECT COALESCE(SUM(amount), 0) FROM billing_transactions WHERE status = 'processed') as total_income,
    (SELECT COALESCE(SUM(amount), 0) FROM billing_transactions WHERE status IN ('pending', 'overdue')) as pending_payments,
    (SELECT COUNT(*) FROM classes WHERE class_date = CURRENT_DATE) as total_classes_today,
    (SELECT COUNT(*) FROM classes WHERE class_date = CURRENT_DATE AND status = 'in_progress') as classes_in_progress,
    (SELECT COUNT(*) FROM teachers WHERE status = 'active') as active_teachers,
    (SELECT COUNT(*) FROM teachers WHERE status = 'on_leave') as teachers_on_leave;
