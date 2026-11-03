@echo off
title Zenve Central Database (zenve_main) Continuous Auto-Sync Daemon
color 0A
echo ==================================================================
echo ZENVE CENTRAL DATABASE (zenve_main) CONTINUOUS AUTO-SYNC DAEMON
echo ==================================================================
echo Target DB : zenve_main
echo Interval  : Every 10 seconds
echo.
echo Replicating all changes (Patients, Owners, Appointments,
echo Prescriptions, Invoices, Vaccinations, Follow-ups, Doctors)
echo directly into zenve_main in real time.
echo.
echo Keep this window running in the background!
echo ==================================================================
echo.

node "scripts\main_db_sync_daemon.js"

pause

