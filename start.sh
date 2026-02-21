#!/bin/bash

# 悄悄话 - 启动脚本

echo "🔐 悄悄话 - 基于邮箱的端到端加密P2P聊天"
echo "========================================="
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js"
    echo ""
    echo "请先安装Node.js:"
    echo "  brew install node"
    exit 1
fi

# 进入项目目录
cd "$(dirname "$0")"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install

    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi

    echo "✅ 依赖安装完成"
    echo ""
fi

# 启动服务
echo "🚀 启动服务..."
echo ""
echo "访问地址: http://localhost:8080"
echo "按 Ctrl+C 停止服务"
echo ""

npm start
