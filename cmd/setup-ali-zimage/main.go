/*
One-shot 工具：读取项目根目录 .env 中的 SQL_DSN，在已有渠道中查找已包含模型 z-image 的配置，
确保 default 分组可用且渠道启用，并刷新 abilities（不写 API Key、不新建渠道）。

运行（在 new-api 仓库根目录）：
  go run ./cmd/setup-ali-zimage
*/

package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const targetModel = "z-image"

func main() {
	gin.SetMode(gin.ReleaseMode)
	gin.DefaultWriter = os.Stdout
	gin.DefaultErrorWriter = os.Stderr

	if err := godotenv.Load(".env"); err != nil {
		log.Printf("警告: 未加载 .env (%v)，将仅使用已导出环境变量", err)
	}

	if os.Getenv("SQL_DSN") == "" {
		log.Fatal("未设置 SQL_DSN：请在 .env 中配置数据库连接串")
	}

	common.InitEnv()

	if err := model.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	if err := model.WaitMigration(); err != nil {
		log.Fatalf("等待迁移失败: %v", err)
	}

	var channels []model.Channel
	if err := model.DB.Find(&channels).Error; err != nil {
		log.Fatalf("查询渠道失败: %v", err)
	}

	var picked *model.Channel
	for i := range channels {
		ch := &channels[i]
		if channelHasExactModel(ch, targetModel) {
			picked = ch
			break
		}
	}

	if picked == nil {
		log.Fatalf("未在任意渠道的「模型」列表中找到精确名称 %q（请检查渠道模型是否为 z-image，或需与前端请求模型名一致）", targetModel)
	}

	beforeGroup := picked.Group
	beforeModels := picked.Models
	// 去掉模型/分组里的首尾空格，避免 abilities 与内存缓存键与请求不一致
	picked.Models = strings.Join(splitCSV(picked.Models), ",")
	picked.Group = strings.Join(splitCSV(picked.Group), ",")
	picked.Status = common.ChannelStatusEnabled
	picked.Group = mergeGroups(picked.Group, "default")

	if err := picked.Update(); err != nil {
		log.Fatalf("更新渠道失败 id=%d: %v", picked.Id, err)
	}

	fmt.Printf("已处理渠道 id=%d name=%s type=%d\n", picked.Id, picked.Name, picked.Type)
	fmt.Printf("  模型列表: %s -> %s\n", beforeModels, picked.Models)
	fmt.Printf("  分组: %s -> %s（已确保含 default）\n", beforeGroup, picked.Group)
	fmt.Printf("  已启用渠道并刷新 abilities。\n")
	fmt.Printf("  请重新编译并重启 new-api（本次更新含渠道缓存 trim 修复），或等待 CHANNEL_UPDATE_FREQUENCY 同步后再试。\n")
}

func channelHasExactModel(ch *model.Channel, model string) bool {
	for _, m := range splitCSV(ch.Models) {
		if strings.EqualFold(strings.TrimSpace(m), model) {
			return true
		}
	}
	return false
}

func splitCSV(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func mergeGroups(existing, need string) string {
	list := splitCSV(existing)
	for _, g := range list {
		if strings.EqualFold(strings.TrimSpace(g), need) {
			return strings.Join(list, ",")
		}
	}
	if len(list) == 0 {
		return need
	}
	return strings.Join(append(list, need), ",")
}
