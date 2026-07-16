package doubao

import (
	"strconv"
	"strings"
)

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// videoInputRatioMap 视频输入折扣比率（含视频单价 / 不含视频单价）。
// 管理员应将 ModelRatio 设置为"不含视频"的较高费率，
// 系统在检测到视频输入时自动乘以此折扣。
// 格式: model -> resolution -> ratio
// 分辨率: "480p", "720p" (基准), "1080p"
var videoInputRatioMap = map[string]map[string]float64{
	"doubao-seedance-2-0-260128": {
		"480p":  28.0 / 46.0, // ~0.6087
		"720p":  28.0 / 46.0, // ~0.6087
		"1080p": 31.0 / 51.0, // ~0.6078
	},
	"doubao-seedance-2-0-fast-260128": {
		"480p":  22.0 / 37.0, // ~0.5946
		"720p":  22.0 / 37.0, // ~0.5946
		"1080p": 22.0 / 37.0, // fast 模型不支持 1080p，按基准计算
	},
}

// resolutionRatioMap 分辨率倍率（以 480p/720p 为基准）。
// 1080p 价格更高，需要乘以此倍率。
var resolutionRatioMap = map[string]float64{
	"480p":  46.0 / 46.0, // 基准
	"720p":  46.0 / 46.0, // 基准
	"1080p": 51.0 / 46.0, // ~1.1087
}

// GetVideoInputRatio 获取视频输入折扣比率。
func GetVideoInputRatio(modelName, resolution string) (float64, bool) {
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

// SizeToDoubaoResolution 将 "WxH" 尺寸字符串转换为豆包分辨率标签。
// 豆包支持: 480p, 720p, 1080p
func SizeToDoubaoResolution(size string) string {
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "720p" // 默认
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	maxDim := w
	if h > maxDim {
		maxDim = h
	}
	if maxDim >= 1920 {
		return "1080p"
	}
	if maxDim >= 1280 {
		return "720p"
	}
	return "480p"
}

// ResolveDoubaoResolution 从 metadata 或 size 中解析分辨率。
func ResolveDoubaoResolution(metadata map[string]interface{}, size string) string {
	// 优先从 metadata 中获取
	if metadata != nil {
		if resolution, ok := metadata["resolution"].(string); ok && resolution != "" {
			return strings.ToLower(resolution)
		}
	}
	// 从 size 转换
	if size != "" {
		return SizeToDoubaoResolution(size)
	}
	return "720p" // 默认
}
