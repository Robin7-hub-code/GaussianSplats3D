@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM GaussianSplats3D 一键运行脚本 (Windows)
REM 这个脚本将自动执行所有必要的步骤来运行项目

echo ==========================================
echo   GaussianSplats3D 一键运行脚本
echo ==========================================
echo.

REM 检查 Node.js 是否安装
echo 📋 检查环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 npm
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 安装依赖包...
    call npm install
    if !errorlevel! neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
) else (
    echo ✅ 依赖已安装
    echo.
)

REM 检查是否已构建
if not exist "build" (
    echo 🔨 构建项目...
    call npm run build-windows
    if !errorlevel! neq 0 (
        echo ❌ 构建失败
        pause
        exit /b 1
    )
    echo ✅ 构建完成
    echo.
) else (
    echo ✅ 项目已构建
    echo.
)

REM 检查演示数据
if not exist "build\demo\assets\data" (
    echo ⚠️  注意: 未找到演示数据
    echo.
    echo 要查看完整演示，请下载数据文件:
    echo https://projects.markkellogg.org/downloads/gaussian_splat_data.zip
    echo.
    echo 并解压到: build\demo\assets\data\
    echo.
    echo 按任意键继续启动服务器...
    pause >nul
)

REM 启动服务器
echo 🚀 启动开发服务器...
echo.
echo 服务器将在 http://localhost:8080 运行
echo 打开浏览器访问: http://localhost:8080/index.html
echo.
echo 按 Ctrl+C 停止服务器
echo.
echo ==========================================

call npm run demo
