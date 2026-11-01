# Zenve Central Consolidated Database Synchronization

This setup provides automatic, real-time database-level synchronization so that all records from **`doctor_crm`** and **`admin_crm`** are replicated into a **3rd central database** (`central_crm`).

---

## 1. Enter Your Database Details

Open [`central_db.env`](file:///d:/New%20folder/new%20docotor/central_db.env) or [`.env`](file:///d:/New%20folder/new%20docotor/.env) and enter your credentials:

```properties
CENTRAL_DB_HOST=127.0.0.1
CENTRAL_DB_PORT=3307
CENTRAL_DB_NAME=zenve_main
CENTRAL_DB_USER=zenve_main_user
CENTRAL_DB_PASSWORD=zenvemain-123
```

---

## 2. How to Apply the Synchronization

### Option A: One-Click Execution (Recommended)
Double-click [`scripts/run_central_db_sync.bat`](file:///d:/New%20folder/new%20docotor/scripts/run_central_db_sync.bat) or run from your terminal:
```bash
node scripts/setup_central_db.js
```
The script will:
1. Connect to MySQL Server 8.0.
2. Create the central database (e.g. `central_crm`).
3. Clone all table structures from `doctor_crm` and `admin_crm`.
4. Install real-time `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` triggers.
5. Backfill all existing records into the 3rd database.

### Option B: Execute in MySQL Workbench / phpMyAdmin
You can open and execute the generated SQL script directly:
- File: [`database/central_db_sync.sql`](file:///d:/New%20folder/new%20docotor/database/central_db_sync.sql)

---

## 3. Synchronized Tables Overview

| Source Database | Table in Source | Replicated Table in 3rd DB | Trigger Events |
|---|---|---|---|
| **`doctor_crm`** | `appointments` | `appointments` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `patients` | `patients` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `doctor_profile` | `doctor_profile` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `prescriptions` | `prescriptions` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `prescription_items` | `prescription_items` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `medical_records` | `medical_records` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `invoices` | `invoices` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `payments` | `payments` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `owners` | `owners` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `follow_ups` | `follow_ups` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `vaccinations` | `vaccinations` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `medicines` | `medicines` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `medicine_batches` | `medicine_batches` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `stock_movements` | `stock_movements` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `notifications` | `doctor_notifications` | INSERT / UPDATE / DELETE |
| **`doctor_crm`** | `email_logs`, `sms_logs`, `whatsapp_logs` | Same | INSERT / UPDATE / DELETE |
| **`admin_crm`** | `admins` | `admin_admins` | INSERT / UPDATE / DELETE |
| **`admin_crm`** | `doctors` | `admin_doctors` | INSERT / UPDATE / DELETE |
| **`admin_crm`** | `notifications` | `admin_notifications` | INSERT / UPDATE / DELETE |

