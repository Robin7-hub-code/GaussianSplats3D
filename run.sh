#!/bin/bash

# GaussianSplats3D 一键运行脚本
# 这个脚本将自动执行所有必要的步骤来运行项目

echo "=========================================="
echo "  GaussianSplats3D 一键运行脚本"
echo "=========================================="
echo ""

# 检查 Node.js 是否安装
echo "📋 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js 版本: $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm 版本: $NPM_VERSION"
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo ""
else
    echo "✅ 依赖已安装"
    echo ""
fi

# 检查是否已构建
if [ ! -d "build" ]; then
    echo "🔨 构建项目..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 构建失败"
        exit 1
    fi
    echo "✅ 构建完成"
    echo ""
else
    echo "✅ 项目已构建"
    echo ""
fi

# 检查演示数据
if [ ! -d "build/demo/assets/data" ]; then
    echo "⚠️  注意: 未找到演示数据"
    echo ""
    echo "要查看完整演示，请下载数据文件:"
    echo "https://projects.markkellogg.org/downloads/gaussian_splat_data.zip"
    echo ""
    echo "并解压到: build/demo/assets/data/"
    echo ""
    echo "按 Enter 继续启动服务器，或按 Ctrl+C 取消..."
    read
fi

# 启动服务器
echo "🚀 启动开发服务器..."
echo ""
echo "服务器将在 http://localhost:8080 运行"
echo "打开浏览器访问: http://localhost:8080/index.html"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""
echo "=========================================="

npm run demo
