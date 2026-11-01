@echo off
title Zenve Central Database Sync Setup
cd /d "%~dp0\.."
node scripts/setup_central_db.js
pause

