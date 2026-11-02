@echo off
title Zenve Central Database Sync (Root)
color 0B
echo ==================================================================
echo ZENVE CENTRAL CONSOLIDATED DATABASE SYNCHRONIZATION
echo ==================================================================
echo Target Database : zenve_main
echo Source Databases: doctor_crm, admin_crm
echo Host / Port     : 127.0.0.1:3307
echo ==================================================================
echo.
echo Please enter the MySQL root password when prompted:
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -P 3307 -u root -p < "database\zenve_main_sync.sql"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==================================================================
    echo [SUCCESS] zenve_main database synchronized successfully!
    echo All mirrored tables, backfilled records, and real-time triggers
    echo are now active in zenve_main.
    echo ==================================================================
) else (
    echo.
    echo ==================================================================
    echo [ERROR] Synchronization encountered an issue. See output above.
    echo ==================================================================
)

echo.
pause

