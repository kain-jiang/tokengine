#!/bin/bash

# 招商银行支付日志查看脚本
# 使用方法:
#   ./view-zs-pay-log.sh          # 查看所有 ZS Pay 相关日志
#   ./view-zs-pay-log.sh -f       # 实时跟踪日志
#   ./view-zs-pay-log.sh -n 50    # 查看最近 50 行

LOG_DIR="./logs"

# 检查日志目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "错误: 日志目录 $LOG_DIR 不存在"
    echo "请确认你在新-api 目录下运行此脚本"
    exit 1
fi

# 获取最新的日志文件
LATEST_LOG=$(ls -t $LOG_DIR/oneapi-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "未找到日志文件"
    exit 1
fi

echo "使用日志文件: $LATEST_LOG"
echo "================================"

case "${1:-}" in
    -f)
        # 实时跟踪
        tail -f "$LATEST_LOG" | grep --color=auto "ZS Pay\|ZSPay\|zs_pay"
        ;;
    -n)
        # 查看指定行数
        NUM="${2:-50}"
        grep "ZS Pay\|ZSPay\|zs_pay" "$LATEST_LOG" | tail -n "$NUM"
        ;;
    *)
        # 默认：查看所有相关日志
        grep "ZS Pay\|ZSPay\|zs_pay" "$LATEST_LOG"
        ;;
esac
