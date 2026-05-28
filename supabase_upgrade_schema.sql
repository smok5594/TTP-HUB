-- ====================================================================
-- TTP HUB ADMIN DASHBOARD - DATABASE UPGRADE & SYNCHRONIZATION SCHEMA
-- Run this script in the SQL Editor of your Supabase Project.
-- This script safely updates the 'students' table adding missing columns 
-- and creates the missing tables/views for full platform functionality.
-- ====================================================================

-- Enable uuid-ossp extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. UPGRADE STUDENTS TABLE (Safely add columns if they don't exist)
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_course VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_group VARCHAR(100) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_type VARCHAR(50) DEFAULT 'grupal' CHECK (class_type IN ('grupal', 'privada', 'conversation_club'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS schedule VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS next_payment DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days');
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthdate VARCHAR(100) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS occupation VARCHAR(100) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(50) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_payment_date DATE DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pendiente' CHECK (payment_status IN ('al_corriente', 'pendiente', 'moroso', 'pago_fallido'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS suspension_date DATE DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_history JSONB DEFAULT '[]';
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollments JSONB DEFAULT '[]';
ALTER TABLE students ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_notes TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS burlington_user VARCHAR(255) DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS certificates_issued INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status_mode VARCHAR(20) DEFAULT 'auto';
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_connection_date DATE DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- 2. CREATE TEACHERS TABLE (If not exists)
CREATE TABLE IF NOT EXISTS teachers (
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

-- 3. CREATE GROUP OCCUPANCY TABLE (If not exists)
CREATE TABLE IF NOT EXISTS group_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 15 NOT NULL,
    enrolled_students INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT check_capacity CHECK (enrolled_students <= capacity)
);

-- 4. CREATE BILLING TRANSACTIONS TABLE (If not exists)
CREATE TABLE IF NOT EXISTS billing_transactions (
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

-- 5. CREATE CLASSES TABLE (If not exists)
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- 6. CREATE TEACHER AVAILABILITY TABLE (If not exists)
CREATE TABLE IF NOT EXISTS teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('disponible', 'no_disponible', 'dia_descanso', 'clase_asignada')),
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    description TEXT DEFAULT ''
);

-- 7. CREATE COURSES TABLE (If not exists)
CREATE TABLE IF NOT EXISTS courses (
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

-- 8. CREATE GROUPS TABLE (If not exists)
CREATE TABLE IF NOT EXISTS groups (
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

-- 9. CREATE SCHEDULES TABLE (If not exists)
CREATE TABLE IF NOT EXISTS schedules (
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

-- 10. CREATE SYSTEM USERS TABLE (If not exists)
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'Teacher',
    status VARCHAR(20) DEFAULT 'activo',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 11. CREATE RECENT ACTIVITIES TABLE (If not exists)
CREATE TABLE IF NOT EXISTS recent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Academic', 'Financial')),
    status VARCHAR(50) CHECK (status IN ('Completed', 'Processed', 'Alert', 'Archived'))
);

-- 12. CREATE OR REPLACE VIEW dashboard_metrics
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
