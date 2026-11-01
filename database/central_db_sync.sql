-- ==============================================================================
-- ZENVE CENTRAL CONSOLIDATED DATABASE SYNCHRONIZATION SCRIPT
-- Replicates all real-time changes from `doctor_crm` & `admin_crm` into `central_crm`
-- ==============================================================================

-- 1. Create 3rd Central Database
CREATE DATABASE IF NOT EXISTS central_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE central_crm;

-- ==============================================================================
-- 2. CREATE MIRRORED TABLES (Cloning exact schema from doctor_crm & admin_crm)
-- ==============================================================================

-- Tables from doctor_crm
CREATE TABLE IF NOT EXISTS central_crm.appointments LIKE doctor_crm.appointments;
CREATE TABLE IF NOT EXISTS central_crm.doctor_profile LIKE doctor_crm.doctor_profile;
CREATE TABLE IF NOT EXISTS central_crm.patients LIKE doctor_crm.patients;
CREATE TABLE IF NOT EXISTS central_crm.owners LIKE doctor_crm.owners;
CREATE TABLE IF NOT EXISTS central_crm.prescriptions LIKE doctor_crm.prescriptions;
CREATE TABLE IF NOT EXISTS central_crm.prescription_items LIKE doctor_crm.prescription_items;
CREATE TABLE IF NOT EXISTS central_crm.medical_records LIKE doctor_crm.medical_records;
CREATE TABLE IF NOT EXISTS central_crm.invoices LIKE doctor_crm.invoices;
CREATE TABLE IF NOT EXISTS central_crm.payments LIKE doctor_crm.payments;
CREATE TABLE IF NOT EXISTS central_crm.follow_ups LIKE doctor_crm.follow_ups;
CREATE TABLE IF NOT EXISTS central_crm.vaccinations LIKE doctor_crm.vaccinations;
CREATE TABLE IF NOT EXISTS central_crm.medicines LIKE doctor_crm.medicines;
CREATE TABLE IF NOT EXISTS central_crm.medicine_batches LIKE doctor_crm.medicine_batches;
CREATE TABLE IF NOT EXISTS central_crm.stock_movements LIKE doctor_crm.stock_movements;
CREATE TABLE IF NOT EXISTS central_crm.users LIKE doctor_crm.users;
CREATE TABLE IF NOT EXISTS central_crm.email_logs LIKE doctor_crm.email_logs;
CREATE TABLE IF NOT EXISTS central_crm.sms_logs LIKE doctor_crm.sms_logs;
CREATE TABLE IF NOT EXISTS central_crm.whatsapp_logs LIKE doctor_crm.whatsapp_logs;
CREATE TABLE IF NOT EXISTS central_crm.doctor_notifications LIKE doctor_crm.notifications;

-- Tables from admin_crm (namespaced to avoid conflict with doctor notifications)
CREATE TABLE IF NOT EXISTS central_crm.admin_admins LIKE admin_crm.admins;
CREATE TABLE IF NOT EXISTS central_crm.admin_doctors LIKE admin_crm.doctors;
CREATE TABLE IF NOT EXISTS central_crm.admin_notifications LIKE admin_crm.notifications;

-- ==============================================================================
-- 3. INITIAL DATA MIGRATION (Backfill all existing data)
-- ==============================================================================

INSERT IGNORE INTO central_crm.appointments SELECT * FROM doctor_crm.appointments;
INSERT IGNORE INTO central_crm.doctor_profile SELECT * FROM doctor_crm.doctor_profile;
INSERT IGNORE INTO central_crm.patients SELECT * FROM doctor_crm.patients;
INSERT IGNORE INTO central_crm.owners SELECT * FROM doctor_crm.owners;
INSERT IGNORE INTO central_crm.prescriptions SELECT * FROM doctor_crm.prescriptions;
INSERT IGNORE INTO central_crm.prescription_items SELECT * FROM doctor_crm.prescription_items;
INSERT IGNORE INTO central_crm.medical_records SELECT * FROM doctor_crm.medical_records;
INSERT IGNORE INTO central_crm.invoices SELECT * FROM doctor_crm.invoices;
INSERT IGNORE INTO central_crm.payments SELECT * FROM doctor_crm.payments;
INSERT IGNORE INTO central_crm.follow_ups SELECT * FROM doctor_crm.follow_ups;
INSERT IGNORE INTO central_crm.vaccinations SELECT * FROM doctor_crm.vaccinations;
INSERT IGNORE INTO central_crm.medicines SELECT * FROM doctor_crm.medicines;
INSERT IGNORE INTO central_crm.medicine_batches SELECT * FROM doctor_crm.medicine_batches;
INSERT IGNORE INTO central_crm.stock_movements SELECT * FROM doctor_crm.stock_movements;
INSERT IGNORE INTO central_crm.users SELECT * FROM doctor_crm.users;
INSERT IGNORE INTO central_crm.email_logs SELECT * FROM doctor_crm.email_logs;
INSERT IGNORE INTO central_crm.sms_logs SELECT * FROM doctor_crm.sms_logs;
INSERT IGNORE INTO central_crm.whatsapp_logs SELECT * FROM doctor_crm.whatsapp_logs;
INSERT IGNORE INTO central_crm.doctor_notifications SELECT * FROM doctor_crm.notifications;

INSERT IGNORE INTO central_crm.admin_admins SELECT * FROM admin_crm.admins;
INSERT IGNORE INTO central_crm.admin_doctors SELECT * FROM admin_crm.doctors;
INSERT IGNORE INTO central_crm.admin_notifications SELECT * FROM admin_crm.notifications;

-- ==============================================================================
-- 4. REAL-TIME MYSQL TRIGGERS (AFTER INSERT, UPDATE, DELETE)
-- ==============================================================================

-- ----------------------------------------------------
-- DOCTOR CRM: appointments triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_appointments_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_appointments_ai
AFTER INSERT ON doctor_crm.appointments
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.appointments SELECT * FROM doctor_crm.appointments WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_appointments_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_appointments_au
AFTER UPDATE ON doctor_crm.appointments
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.appointments SELECT * FROM doctor_crm.appointments WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_appointments_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_appointments_ad
AFTER DELETE ON doctor_crm.appointments
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.appointments WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: patients triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_patients_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_patients_ai
AFTER INSERT ON doctor_crm.patients
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.patients SELECT * FROM doctor_crm.patients WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_patients_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_patients_au
AFTER UPDATE ON doctor_crm.patients
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.patients SELECT * FROM doctor_crm.patients WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_patients_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_patients_ad
AFTER DELETE ON doctor_crm.patients
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.patients WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: doctor_profile triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_doctor_profile_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doctor_profile_ai
AFTER INSERT ON doctor_crm.doctor_profile
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.doctor_profile SELECT * FROM doctor_crm.doctor_profile WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_doctor_profile_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doctor_profile_au
AFTER UPDATE ON doctor_crm.doctor_profile
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.doctor_profile SELECT * FROM doctor_crm.doctor_profile WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_doctor_profile_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doctor_profile_ad
AFTER DELETE ON doctor_crm.doctor_profile
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.doctor_profile WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: prescriptions triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_prescriptions_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescriptions_ai
AFTER INSERT ON doctor_crm.prescriptions
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.prescriptions SELECT * FROM doctor_crm.prescriptions WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_prescriptions_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescriptions_au
AFTER UPDATE ON doctor_crm.prescriptions
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.prescriptions SELECT * FROM doctor_crm.prescriptions WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_prescriptions_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescriptions_ad
AFTER DELETE ON doctor_crm.prescriptions
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.prescriptions WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: prescription_items triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_prescription_items_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescription_items_ai
AFTER INSERT ON doctor_crm.prescription_items
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.prescription_items SELECT * FROM doctor_crm.prescription_items WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_prescription_items_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescription_items_au
AFTER UPDATE ON doctor_crm.prescription_items
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.prescription_items SELECT * FROM doctor_crm.prescription_items WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_prescription_items_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_prescription_items_ad
AFTER DELETE ON doctor_crm.prescription_items
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.prescription_items WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: medical_records triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_medical_records_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medical_records_ai
AFTER INSERT ON doctor_crm.medical_records
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medical_records SELECT * FROM doctor_crm.medical_records WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medical_records_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medical_records_au
AFTER UPDATE ON doctor_crm.medical_records
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medical_records SELECT * FROM doctor_crm.medical_records WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medical_records_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medical_records_ad
AFTER DELETE ON doctor_crm.medical_records
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.medical_records WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: invoices triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_invoices_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_invoices_ai
AFTER INSERT ON doctor_crm.invoices
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.invoices SELECT * FROM doctor_crm.invoices WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_invoices_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_invoices_au
AFTER UPDATE ON doctor_crm.invoices
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.invoices SELECT * FROM doctor_crm.invoices WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_invoices_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_invoices_ad
AFTER DELETE ON doctor_crm.invoices
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.invoices WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: payments triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_payments_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_payments_ai
AFTER INSERT ON doctor_crm.payments
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.payments SELECT * FROM doctor_crm.payments WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_payments_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_payments_au
AFTER UPDATE ON doctor_crm.payments
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.payments SELECT * FROM doctor_crm.payments WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_payments_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_payments_ad
AFTER DELETE ON doctor_crm.payments
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.payments WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: owners triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_owners_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_owners_ai
AFTER INSERT ON doctor_crm.owners
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.owners SELECT * FROM doctor_crm.owners WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_owners_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_owners_au
AFTER UPDATE ON doctor_crm.owners
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.owners SELECT * FROM doctor_crm.owners WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_owners_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_owners_ad
AFTER DELETE ON doctor_crm.owners
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.owners WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: follow_ups triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_follow_ups_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_follow_ups_ai
AFTER INSERT ON doctor_crm.follow_ups
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.follow_ups SELECT * FROM doctor_crm.follow_ups WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_follow_ups_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_follow_ups_au
AFTER UPDATE ON doctor_crm.follow_ups
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.follow_ups SELECT * FROM doctor_crm.follow_ups WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_follow_ups_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_follow_ups_ad
AFTER DELETE ON doctor_crm.follow_ups
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.follow_ups WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: vaccinations triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_vaccinations_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_vaccinations_ai
AFTER INSERT ON doctor_crm.vaccinations
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.vaccinations SELECT * FROM doctor_crm.vaccinations WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_vaccinations_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_vaccinations_au
AFTER UPDATE ON doctor_crm.vaccinations
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.vaccinations SELECT * FROM doctor_crm.vaccinations WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_vaccinations_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_vaccinations_ad
AFTER DELETE ON doctor_crm.vaccinations
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.vaccinations WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: medicines triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_medicines_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicines_ai
AFTER INSERT ON doctor_crm.medicines
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medicines SELECT * FROM doctor_crm.medicines WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medicines_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicines_au
AFTER UPDATE ON doctor_crm.medicines
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medicines SELECT * FROM doctor_crm.medicines WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medicines_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicines_ad
AFTER DELETE ON doctor_crm.medicines
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.medicines WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: medicine_batches triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_medicine_batches_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicine_batches_ai
AFTER INSERT ON doctor_crm.medicine_batches
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medicine_batches SELECT * FROM doctor_crm.medicine_batches WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medicine_batches_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicine_batches_au
AFTER UPDATE ON doctor_crm.medicine_batches
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.medicine_batches SELECT * FROM doctor_crm.medicine_batches WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_medicine_batches_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_medicine_batches_ad
AFTER DELETE ON doctor_crm.medicine_batches
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.medicine_batches WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: stock_movements triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_stock_movements_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_stock_movements_ai
AFTER INSERT ON doctor_crm.stock_movements
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.stock_movements SELECT * FROM doctor_crm.stock_movements WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_stock_movements_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_stock_movements_au
AFTER UPDATE ON doctor_crm.stock_movements
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.stock_movements SELECT * FROM doctor_crm.stock_movements WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_stock_movements_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_stock_movements_ad
AFTER DELETE ON doctor_crm.stock_movements
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.stock_movements WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- DOCTOR CRM: notifications triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS doctor_crm.trg_doc_notifications_ai;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doc_notifications_ai
AFTER INSERT ON doctor_crm.notifications
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.doctor_notifications SELECT * FROM doctor_crm.notifications WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_doc_notifications_au;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doc_notifications_au
AFTER UPDATE ON doctor_crm.notifications
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.doctor_notifications SELECT * FROM doctor_crm.notifications WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS doctor_crm.trg_doc_notifications_ad;
DELIMITER $$
CREATE TRIGGER doctor_crm.trg_doc_notifications_ad
AFTER DELETE ON doctor_crm.notifications
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.doctor_notifications WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- ADMIN CRM: admins triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS admin_crm.trg_admin_admins_ai;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_admins_ai
AFTER INSERT ON admin_crm.admins
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_admins SELECT * FROM admin_crm.admins WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_admins_au;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_admins_au
AFTER UPDATE ON admin_crm.admins
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_admins SELECT * FROM admin_crm.admins WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_admins_ad;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_admins_ad
AFTER DELETE ON admin_crm.admins
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.admin_admins WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- ADMIN CRM: doctors triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS admin_crm.trg_admin_doctors_ai;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_doctors_ai
AFTER INSERT ON admin_crm.doctors
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_doctors SELECT * FROM admin_crm.doctors WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_doctors_au;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_doctors_au
AFTER UPDATE ON admin_crm.doctors
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_doctors SELECT * FROM admin_crm.doctors WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_doctors_ad;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_doctors_ad
AFTER DELETE ON admin_crm.doctors
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.admin_doctors WHERE id = OLD.id;
END$$
DELIMITER ;

-- ----------------------------------------------------
-- ADMIN CRM: notifications triggers
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS admin_crm.trg_admin_notifications_ai;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_notifications_ai
AFTER INSERT ON admin_crm.notifications
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_notifications SELECT * FROM admin_crm.notifications WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_notifications_au;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_notifications_au
AFTER UPDATE ON admin_crm.notifications
FOR EACH ROW
BEGIN
    REPLACE INTO central_crm.admin_notifications SELECT * FROM admin_crm.notifications WHERE id = NEW.id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS admin_crm.trg_admin_notifications_ad;
DELIMITER $$
CREATE TRIGGER admin_crm.trg_admin_notifications_ad
AFTER DELETE ON admin_crm.notifications
FOR EACH ROW
BEGIN
    DELETE FROM central_crm.admin_notifications WHERE id = OLD.id;
END$$
DELIMITER ;

-- ==============================================================================
-- 5. UNIFIED DOCTORS VIEW IN CENTRAL DATABASE
-- Provides unified access to approved doctors for Zippy CRM and Marketplace
-- ==============================================================================

CREATE OR REPLACE VIEW central_crm.doctors AS
SELECT 
    u.id AS id,
    u.id AS user_id,
    COALESCE(NULLIF(dp.full_name, ''), u.full_name, 'Dr. Doctor') AS name,
    u.full_name AS full_name,
    u.email AS email,
    COALESCE(NULLIF(dp.phone, ''), u.phone, '') AS phone,
    COALESCE(NULLIF(dp.clinic_hospital, ''), 'Zenve Clinic') AS clinic_hospital,
    COALESCE(NULLIF(dp.clinic_hospital, ''), 'Zenve Clinic') AS clinic_name,
    COALESCE(NULLIF(dp.facility_type, ''), 'Clinic') AS facility_type,
    COALESCE(NULLIF(dp.area, ''), '') AS area,
    COALESCE(NULLIF(dp.city, ''), 'Bengaluru') AS city,
    COALESCE(dp.pincode, 560001) AS pincode,
    COALESCE(NULLIF(dp.speciality, ''), 'Veterinarian') AS specializations,
    COALESCE(NULLIF(dp.speciality, ''), 'Veterinarian') AS speciality,
    COALESCE(NULLIF(dp.qualification, ''), 'BVSc & AH') AS qualification,
    COALESCE(dp.experience, 5) AS experience_years,
    COALESCE(dp.experience, 5) AS experience,
    COALESCE(dp.consultation_fee, 500.0) AS consultation_fee,
    COALESCE(dp.follow_up_fee, 300.0) AS follow_up_fee,
    COALESCE(dp.video_consultation_enabled, 1) AS video_consultation_enabled,
    COALESCE(NULLIF(dp.profile_image, ''), '') AS profile_image,
    COALESCE(NULLIF(dp.clinic_phone, ''), u.phone, '') AS clinic_phone,
    COALESCE(dp.kyc_verified, 0) AS kyc_verified,
    COALESCE(dp.veterinary_registration_verified, 0) AS veterinary_registration_verified,
    (CASE WHEN u.approval_status = 'APPROVED' THEN 'verified' ELSE 'pending' END) AS verification_status,
    u.approval_status AS approval_status,
    1 AS is_active,
    u.created_at AS created_at,
    u.updated_at AS updated_at
FROM central_crm.users u
LEFT JOIN central_crm.doctor_profile dp ON u.id = dp.user_id
WHERE u.role = 'DOCTOR';


