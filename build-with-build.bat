@echo off
chcp 65001 >nul

REM Set LLVM path
set LIBCLANG_PATH=C:\Program Files\LLVM\bin

REM Set MSVC compiler path
set PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%

REM Set Windows SDK Include path (including VC++ Runtime)
set INCLUDE=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared

REM Set Windows SDK Lib path
set LIB=C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64

echo Environment variables set successfully!
echo LIBCLANG_PATH=%LIBCLANG_PATH%
echo.

REM Run the build command
pnpm tauri build
