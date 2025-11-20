@echo off
setlocal enabledelayedexpansion

echo =====================================================
echo Word Domination Solver - Complete Build Script
echo =====================================================
echo.

REM Step 0: Compile GADDAG
echo Step 0: Compiling GADDAG dictionary...
echo ----------------------------------------
if not exist "dictionary\dictionary.txt" (
    echo ERROR: dictionary\dictionary.txt not found!
    exit /b 1
)

cargo run --release --bin gaddag_compiler -- "dictionary\dictionary.txt" "dictionary\dictionary.gaddag"
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m GADDAG compiled successfully
echo.

REM Step 1: Build Frontend
echo Step 1: Building frontend...
echo ----------------------------------------
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

call npm run build
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m Frontend built successfully
echo.

REM Step 2: Copy frontend build to solver/static
echo Step 2: Copying frontend to solver/static...
echo ----------------------------------------
cd ..
if exist "solver\static" rmdir /s /q "solver\static"
xcopy /E /I /Y "frontend\dist" "solver\static"
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m Frontend copied to solver/static
echo.

REM Step 3: Build Backend
echo Step 3: Building backend...
echo ----------------------------------------
cd solver
cargo build --release
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m Backend built successfully
echo.

REM Step 4: Show next steps
echo =====================================================
echo Build Complete!
echo =====================================================
echo.
echo To run the complete application:
echo   cd solver
echo   ..\target\release\solver.exe
echo.
echo Or use:
echo   cargo run --release --bin solver
echo.
echo The application will be available at http://localhost:3000
echo.
