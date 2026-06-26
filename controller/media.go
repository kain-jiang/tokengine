package controller

import (
	"encoding/base64"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// UploadMedia 上传媒体文件（图片/视频），使用base64存储
func UploadMedia(c *gin.Context) {
	userId := c.GetInt("id")

	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 打开文件
	src, err := file.Open()
	if err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("%s文件上传失败", file.Filename))
		return
	}
	defer src.Close()

	// 读取文件内容
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("%s文件上传失败", file.Filename))
		return
	}

	// 转换为base64
	base64Content := base64.StdEncoding.EncodeToString(fileBytes)

	// 判断媒体类型
	mediaType := model.MediaTypeImage
	if file.Header.Get("Content-Type") == "video/mp4" {
		mediaType = model.MediaTypeVideo
	}

	// 创建媒体记录
	media := model.Media{
		UserId:        userId,
		MediaType:     mediaType,
		Filename:      file.Filename,
		Filesize:      file.Size,
		Base64Content: base64Content,
		CreatedAt:     time.Now().Unix(),
		UpdatedAt:     time.Now().Unix(),
	}

	// 保存到数据库
	err = model.DB.Create(&media).Error
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	// 返回访问URL
	mediaUrl := fmt.Sprintf("/api/user/media/%d", media.Id)
	media.Url = mediaUrl

	// 更新URL
	err = model.DB.Model(&media).Update("url", mediaUrl).Error
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	common.ApiSuccess(c, gin.H{
		"id":      media.Id,
		"url":     mediaUrl,
		"content": media.Base64Content,
	})
}

// GetMedia 获取媒体文件
func GetMedia(c *gin.Context) {
	// 获取媒体ID
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid media ID")
		return
	}

	// 查询媒体记录
	var media model.Media
	err = model.DB.Where("id = ?", id).First(&media).Error
	if err != nil {
		common.ApiErrorMsg(c, "Media not found")
		return
	}

	common.ApiSuccess(c, gin.H{
		"id":      media.Id,
		"content": media.Base64Content,
	})
}
