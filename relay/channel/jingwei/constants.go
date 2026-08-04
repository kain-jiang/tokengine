package jingwei

import (
	"strings"
)

var ModelList = []string{
	"doubao-seedance-1.5-pro",
	"doubao-seedance-2.0",
	"doubao-seedance-2.0-fast",
}

// videoInputRatioMap 视频输入折扣比率（含视频单价 / 不含视频单价）。
// 管理员应将 ModelRatio 设置为"不含视频"的较高费率，
// 系统在检测到视频输入时自动乘以此折扣。
// 格式: model -> resolution -> ratio
// 分辨率: "480p", "720p", "1080p", "4k"
var videoInputRatioMap = map[string]map[string]float64{
	"doubao-seedance-2.0": {
		"480p":  28.0 / 46.0, // ~0.6087
		"720p":  28.0 / 46.0, // ~0.6087
		"1080p": 31.0 / 51.0, // ~0.6078
		"4k":    16.0 / 26.0, // ~0.6154
	},
	"doubao-seedance-2.0-fast": {
		"480p":  22.0 / 37.0, // ~0.6087
		"720p":  22.0 / 37.0, // ~0.6087
		"1080p": 22.0 / 37.0, // ~0.6078 不支持 1080p, 默认480p倍率
		"4k":    22.0 / 37.0, // ~0.6154 不支持 4k，默认480p倍率
	},
	"doubao-seedance-2.0-mini": {
		"480p":  14.0 / 23.0, // ~0.6087
		"720p":  14.0 / 23.0, // ~0.6087
		"1080p": 14.0 / 23.0, // ~0.6078 不支持 1080p, 默认480p倍率
		"4k":    14.0 / 23.0, // ~0.6154 不支持 4k，默认480p倍率
	},
}

// resolutionRatioMap 分辨率倍率（以 720p 为基准）。
// 1080p 和 4k 价格更高，需要乘以此倍率。
// 这里不管是什么模型，分辨率倍率都是 1.0都没啥问题，但是1080p和4k计价就会多扣费
var resolutionRatioMap = map[string]float64{
	"480p":  46.0 / 46.0, // ~1.0
	"720p":  46.0 / 46.0, // 基准 1.0
	"1080p": 51.0 / 46.0, // ~1.1087
	"4k":    26.0 / 46.0, // ~0.5652 (4k 单价更低，但倍率按实际价格计算)
}

// GetVideoInputRatio 获取视频输入折扣比率。
func GetVideoInputRatio(modelName, resolution string) (float64, bool) {
	// 标准化模型名称
	modelName = strings.ToLower(modelName)
	modelMap, ok := videoInputRatioMap[modelName]
	if !ok {
		return 0, false
	}
	ratio, ok := modelMap[resolution]
	return ratio, ok
}

// GetResolutionRatio 获取分辨率倍率。
func GetResolutionRatio(resolution string) float64 {
	if ratio, ok := resolutionRatioMap[resolution]; ok {
		return ratio
	}
	return 1.0 // 默认返回基准倍率
}

// ResolveJingweiResolution 从 metadata 中解析分辨率。
// size 参数是宽高比（如 "16:9"），不是分辨率，所以不从 size 转换。
func ResolveJingweiResolution(metadata map[string]interface{}, size string) string {
	// 优先从 metadata 中获取
	if metadata != nil {
		if resolution, ok := metadata["resolution"].(string); ok && resolution != "" {
			return strings.ToLower(resolution)
		}
	}
	// size 是宽高比，不用于解析分辨率
	// 返回默认值 720p（Seedance 2.0 系列、Seedance 1.5 Pro）
	return "720p"
}
