@echo off
rem Owner full build of the studio: every upstream feature shown (apps/web/.env.full).
cd /d "%~dp0apps\web"
pnpm dev:full
