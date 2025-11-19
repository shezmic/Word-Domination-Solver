@echo off
setlocal enabledelayedexpansion

echo =====================================================
echo Word Domination Solver - Build Script
echo =====================================================
echo.

REM Check if Rust is installed
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cargo not found!
    echo.
    echo Please install Rust first:
    echo   Download from https://rustup.rs/
    echo   Or use: winget install Rustlang.Rustup
    echo.
    echo Then restart your terminal and run this script again.
    exit /b 1
)

for /f "tokens=*" %%i in ('cargo --version') do set CARGO_VERSION=%%i
echo [32m✓[0m Rust toolchain found: !CARGO_VERSION!
echo.

REM Step 1: Compile GADDAG if needed
if not exist "dictionary\dictionary.gaddag" (
    goto compile_gaddag
)
if "%1"=="--recompile-gaddag" (
    goto compile_gaddag
)
goto skip_gaddag

:compile_gaddag
echo Step 1: Compiling GADDAG dictionary...
echo ----------------------------------------

if not exist "dictionary\dictionary.txt" (
    echo ERROR: dictionary\dictionary.txt not found!
    exit /b 1
)

cargo build --release --bin gaddag_compiler
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

cargo run --release --bin gaddag_compiler dictionary\dictionary.txt dictionary\dictionary.gaddag
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m GADDAG compiled successfully
echo.
goto build_solver

:skip_gaddag
echo Step 1: Using existing GADDAG dictionary
echo   (Use --recompile-gaddag to force recompilation)
echo.

:build_solver
REM Step 2: Build solver
echo Step 2: Building solver...
echo ----------------------------------------
cargo build --release
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [32m✓[0m Solver built successfully
echo.

REM Step 3: Show next steps
echo =====================================================
echo Build Complete!
echo =====================================================
echo.
echo To run the solver server:
echo   .\target\release\solver.exe
echo.
echo Or use:
echo   cargo run --release --bin solver
echo.
echo The server will listen on http://localhost:3000
echo.
