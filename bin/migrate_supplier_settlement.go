package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"new-api/common"
	"new-api/model"

	_ "github.com/lib/pq"
	"gorm.io/gorm"
)

func main() {
	// 初始化配置
	common.InitConfig()

	// 连接数据库
	var db *gorm.DB
	var err error

	if common.UsingPostgreSQL {
		db, err = model.InitPGDB()
		if err != nil {
			fmt.Printf("连接 PostgreSQL 数据库失败: %v\n", err)
			return
		}
	} else {
		fmt.Println("当前不支持此迁移脚本")
		return
	}

	defer func() {
		if err := db.Close(); err != nil {
			fmt.Printf("关闭数据库连接失败: %v\n", err)
		}
	}()

	fmt.Println("数据库连接成功!")

	// 读取 SQL 文件
	sqlFile := "create_supplier_settlement_tables-pg.sql"
	file, err := os.Open(sqlFile)
	if err != nil {
		fmt.Printf("打开 SQL 文件失败: %v\n", err)
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		fmt.Printf("读取 SQL 文件失败: %v\n", err)
		return
	}

	// 分割 SQL 语句
	sqlStatements := splitSQLStatements(string(content))

	executed := 0
	skipped := 0

	for i, stmt := range sqlStatements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}

		// 跳过 FOREIGN KEY 语句的单独检查（PostgreSQL 支持）
		if strings.Contains(stmt, "FOREIGN KEY") {
			fmt.Printf("[%d] 执行: %s...\n", i+1, truncateString(stmt, 50))
			if err := db.Exec(stmt).Error; err != nil {
				fmt.Printf("  警告: %v\n", err)
				skipped++
			} else {
				fmt.Println("  成功!")
				executed++
			}
			continue
		}

		fmt.Printf("[%d] 执行: %s...\n", i+1, truncateString(stmt, 50))
		if err := db.Exec(stmt).Error; err != nil {
			fmt.Printf("  警告: %v\n", err)
			skipped++
		} else {
			fmt.Println("  成功!")
			executed++
		}
	}

	fmt.Printf("\n迁移完成!\n")
	fmt.Printf("  执行: %d\n", executed)
	fmt.Printf("  跳过/警告: %d\n", skipped)
}

func splitSQLStatements(sql string) []string {
	statements := []string{}
	current := strings.Builder{}
	inQuote := false
	quoteChar := rune(0)
	prevChar := rune(0)

	for _, char := range sql {
		switch {
		case char == '"' && prevChar != '\\':
			if !inQuote {
				inQuote = true
				quoteChar = char
			} else if char == quoteChar {
				inQuote = false
			}
		case (char == ';' || char == '\n') && !inQuote:
			if current.Len() > 0 {
				stmt := current.String()
				trimmed := strings.TrimSpace(stmt)
				if trimmed != "" && !strings.HasPrefix(trimmed, "--") {
					statements = append(statements, trimmed)
				}
				current.Reset()
			}
			if char == '\n' && !inQuote {
				continue
			}
		default:
			current.WriteRune(char)
		}
		prevChar = char
	}

	// 添加最后一个语句（如果没有分号）
	if current.Len() > 0 {
		stmt := strings.TrimSpace(current.String())
		if stmt != "" && !strings.HasPrefix(stmt, "--") {
			statements = append(statements, stmt)
		}
	}

	return statements
}

func truncateString(s string, maxLen int) string {
	// 移除换行符和多余空格
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	for len(strings.TrimSpace(s)) > maxLen {
		s = s[:maxLen] + "..."
	}
	return strings.TrimSpace(s)
}
