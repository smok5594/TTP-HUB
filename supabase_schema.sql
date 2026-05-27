-- ====================================================================
-- TTP HUB ADMIN DASHBOARD - SQL INITIALIZATION SCHEMA
-- Run this script in the SQL Editor of your Supabase Project.
-- ====================================================================

-- 1. CLEANUP (Optional - caution in production)
DROP TABLE IF EXISTS recent_activities CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS billing_transactions CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS group_occupancy CASCADE;

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STUDENTS TABLE
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) DEFAULT '',
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'graduated', 'prospect', 'moroso')),
    enrolled_date DATE DEFAULT CURRENT_DATE NOT NULL,
    current_course VARCHAR(255) DEFAULT 'English B2 - Advanced',
    current_group VARCHAR(100) DEFAULT 'Grupo A',
    class_type VARCHAR(50) DEFAULT 'grupal' CHECK (class_type IN ('grupal', 'privada', 'conversation_club')),
    schedule VARCHAR(255) DEFAULT 'Lunes y Miércoles 18:00–19:30',
    teacher VARCHAR(255) DEFAULT 'James Wilson',
    next_payment DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    phone VARCHAR(50) DEFAULT '+52 55 1234 5678',
    birthdate VARCHAR(100) DEFAULT '14 de Mayo, 1995',
    address VARCHAR(255) DEFAULT 'Av. Reforma 222, Ciudad de México, CP 06600',
    nationality VARCHAR(100) DEFAULT 'Mexicana',
    occupation VARCHAR(100) DEFAULT 'Project Manager en TechCorp',
    amount_due NUMERIC(10, 2) DEFAULT 2450.00,
    payment_reference VARCHAR(50) DEFAULT 'REF-MOR-2024',
    last_payment_date DATE DEFAULT '2023-10-02',
    payment_status VARCHAR(50) DEFAULT 'pendiente' CHECK (payment_status IN ('al_corriente', 'pendiente', 'moroso', 'pago_fallido')),
    suspension_date DATE DEFAULT NULL,
    suspension_reason TEXT DEFAULT NULL,
    course_history JSONB DEFAULT '[]',
    admin_notes TEXT DEFAULT '',
    academic_notes TEXT DEFAULT '',
    burlington_user VARCHAR(255) DEFAULT '',
    certificates_issued INTEGER DEFAULT 0
);

-- 3. GROUP OCCUPANCY TABLE
CREATE TABLE group_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 15 NOT NULL,
    enrolled_students INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT check_capacity CHECK (enrolled_students <= capacity)
);

-- 4. BILLING TRANSACTIONS TABLE
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('processed', 'pending', 'overdue')),
    category VARCHAR(100) DEFAULT 'Financial'
);

-- 5. TEACHERS TABLE
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    specialty VARCHAR(100),
    rate NUMERIC(10, 2),
    since DATE,
    birthdate DATE,
    burlington_user VARCHAR(255),
    burlington_pass VARCHAR(255),
    ttp_user VARCHAR(255),
    ttp_pass VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'on_leave'))
);

-- 6. CLASSES TABLE
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- 7. RECENT ACTIVITIES TABLE
CREATE TABLE recent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Academic', 'Financial')),
    status VARCHAR(50) CHECK (status IN ('Completed', 'Processed', 'Alert', 'Archived'))
);

-- ====================================================================
-- SEED INITIAL MOCK DATA
-- ====================================================================

-- Insert active/new students matching the dynamic dashboard design
INSERT INTO students (name, last_name, email, status, current_course, current_group, class_type, schedule, teacher, next_payment, enrolled_date, phone, birthdate, address, nationality, occupation, amount_due, payment_reference, last_payment_date, payment_status, burlington_user, certificates_issued, academic_notes, admin_notes, course_history) VALUES
('Elena', 'Rodríguez', 'elena.rod@email.com', 'active', 'English B2 - Advanced', 'Grupo B2-Avanzado', 'grupal', 'Lunes y Miércoles 17:00–18:30', 'James Wilson', '2023-10-15', CURRENT_DATE - INTERVAL '15 days', '+52 55 9876 5432', '10 de Febrero, 1998', 'Av. Insurgentes 450, CDMX', 'Mexicana', 'Estudiante', 0.00, 'REF-ELE-2024', '2023-09-15', 'al_corriente', 'elena.rodriguez@ttp', 1, 'Excelente dominio de gramática. Mejorar pronunciación.', 'Alumna puntual y comprometida.', '[{"course":"English A1 – Beginner","period":"Ene 2022 – Jun 2022","status":"completado"}]'),
('Carlos', 'Méndez', 'c.mendez@mail.es', 'active', 'Conversation Club', 'Conversation Club Avanzado', 'conversation_club', 'Viernes 19:00–20:30', 'Sarah Parker', '2023-10-01', CURRENT_DATE - INTERVAL '45 days', '+34 612 345 678', '05 de Agosto, 1990', 'Calle Mayor 12, Madrid', 'Española', 'Diseñador Gráfico', 0.00, 'REF-CAR-2024', '2023-09-01', 'al_corriente', 'carlos.mendez@ttp', 0, 'Buena fluidez oral pero necesita refuerzo en escritura.', 'Al corriente.', '[{"course":"English B1 – Intermediate","period":"Mar 2022 – Dic 2022","status":"completado"}]'),
('Lucía', 'Ferreyra', 'lucia.f@provider.com', 'active', 'Business English', 'Business English Corp', 'privada', 'Martes y Jueves 09:00–10:00', 'Robert Brown', '2023-10-22', CURRENT_DATE - INTERVAL '10 days', '+54 11 2345 6789', '28 de Noviembre, 1992', 'Av. Santa Fe 1200, Buenos Aires', 'Argentina', 'Analista de Negocios', 0.00, 'REF-LUC-2024', '2023-09-22', 'al_corriente', 'lucia.ferreyra@ttp', 2, 'Dominio de vocabulario corporativo. Excelente en presentaciones.', 'Alumna VIP. Prefiere horarios de mañana.', '[{"course":"Business English Básico","period":"Ene 2023 – Jun 2023","status":"completado"}]'),
('Mateo', 'Vizcarra', 'm.viz@email.com', 'active', 'English A1 - Beginner', 'Grupo A1-Principiantes', 'grupal', 'Lunes, Miércoles y Viernes 16:00–17:00', 'Anna Smith', '2023-09-28', CURRENT_DATE - INTERVAL '60 days', '+51 987 654 321', '12 de Julio, 2001', 'Av. Larco 789, Lima', 'Peruana', 'Desarrollador Junior', 0.00, 'REF-MAT-2024', '2023-08-28', 'al_corriente', '', 0, 'Requiere apoyo adicional en comprensión auditiva.', 'Al corriente.', '[]');

-- Insert groups for occupancy rate (84% average calculation target)
INSERT INTO group_occupancy (group_name, capacity, enrolled_students) VALUES
('Group English A1', 15, 12),
('Group English B2', 15, 14),
('Group Bilingual Program', 20, 16),
('Group Conversation Club', 25, 20);

-- Insert billing and cash flow records (Inicia en $0)
-- No se pre-cargan facturas mock para evitar ingresos inventados.

-- Insert teachers
INSERT INTO teachers (name, status, specialty) VALUES
('Lic. Elena Valdéz', 'active', 'English Mastery B2'),
('Prof. John Doe', 'active', 'Bilingual Tech'),
('Lic. Maria Gomez', 'on_leave', 'Conversation Advanced'),
('Prof. Alex Ramirez', 'on_leave', 'IELTS Prep');

-- Insert classes scheduled for today
INSERT INTO classes (title, teacher_id, class_date, status) VALUES
('English Mastery B2', NULL, CURRENT_DATE, 'in_progress'),
('IELTS Speaking Prep', NULL, CURRENT_DATE, 'scheduled'),
('Basic Grammar Workshop', NULL, CURRENT_DATE, 'completed');

-- Insert recent activity logs (Inicia vacío)

-- Create simple database views to aggregate metrics quickly
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
    (SELECT COUNT(*) FROM students WHERE status = 'active') as active_students,
    (SELECT COUNT(*) FROM students WHERE status = 'active' AND enrolled_date >= date_trunc('month', CURRENT_DATE)) as new_students_this_month,
    ROUND((SELECT SUM(enrolled_students)::NUMERIC / SUM(capacity)::NUMERIC * 100 FROM group_occupancy), 0) as occupancy_rate,
    (SELECT COALESCE(SUM(amount), 0) FROM billing_transactions WHERE status = 'processed') as total_income,
    (SELECT COALESCE(SUM(amount), 0) FROM billing_transactions WHERE status IN ('pending', 'overdue')) as pending_payments,
    (SELECT COUNT(*) FROM classes WHERE class_date = CURRENT_DATE) as total_classes_today,
    (SELECT COUNT(*) FROM classes WHERE class_date = CURRENT_DATE AND status = 'in_progress') as classes_in_progress,
    (SELECT COUNT(*) FROM teachers WHERE status = 'active') as active_teachers,
    (SELECT COUNT(*) FROM teachers WHERE status = 'on_leave') as teachers_on_leave;
