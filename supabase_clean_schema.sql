-- ====================================================================
-- TTP HUB ADMIN DASHBOARD - CLEAN INITIALIZATION SCHEMA
-- Run this script in the SQL Editor of your Supabase Project to create all tables.
-- This script does NOT insert any mock/seed data, ensuring a clean database.
-- ====================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
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
    admin_notes TEXT DEFAULT '',
    academic_notes TEXT DEFAULT '',
    burlington_user VARCHAR(255) DEFAULT '',
    certificates_issued INTEGER DEFAULT 0
);

-- 2. GROUP OCCUPANCY TABLE
CREATE TABLE IF NOT EXISTS group_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 15 NOT NULL,
    enrolled_students INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT check_capacity CHECK (enrolled_students <= capacity)
);

-- 3. BILLING TRANSACTIONS TABLE
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

-- 4. TEACHERS TABLE
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

-- 5. CLASSES TABLE
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- 6. TEACHER AVAILABILITY TABLE
CREATE TABLE IF NOT EXISTS teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('disponible', 'no_disponible', 'dia_descanso', 'clase_asignada')),
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    description TEXT DEFAULT ''
);

-- 7. COURSES TABLE
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

-- 8. GROUPS TABLE
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

-- 9. SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    group_name VARCHAR(255) DEFAULT '',
    level VARCHAR(100) DEFAULT '',
    days_selected JSONB DEFAULT '[]',
    start_time VARCHAR(10) DEFAULT '08:00',
    end_time VARCHAR(10) DEFAULT '09:00',
    start_date DATE,
    end_date DATE,
    capacity INTEGER DEFAULT 15,
    class_type VARCHAR(50) DEFAULT 'grupal',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 10. SYSTEM USERS TABLE
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'Teacher',
    status VARCHAR(20) DEFAULT 'activo',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 11. RECENT ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS recent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Academic', 'Financial')),
    status VARCHAR(50) CHECK (status IN ('Completed', 'Processed', 'Alert', 'Archived'))
);

-- 12. DYNAMIC METRICS VIEW
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
