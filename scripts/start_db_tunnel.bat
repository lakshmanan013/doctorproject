@echo off
title Zenve Database SSH Tunnel (Port 3307)
echo ==================================================================
echo Starting SSH Tunnel for Zenve Database on port 3307...
echo Forwarding 127.0.0.1:3307 -> 95.135.254.123:3306
echo Keep this window OPEN while running Doctor / Admin Backends!
echo ==================================================================
ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -L 3307:127.0.0.1:3306 root@95.135.254.123 -p 22
pause

