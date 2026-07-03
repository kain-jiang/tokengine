package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InvoiceTitleRequest struct {
	Type           string `json:"type"`
	Title          string `json:"title"`
	USCC           string `json:"uscc"`
	CompanyAddress string `json:"company_address"`
	CompanyPhone   string `json:"company_phone"`
	BankName       string `json:"bank_name"`
	BankAccount    string `json:"bank_account"`
	Email          string `json:"email"`
}

type InvoiceApplyRequest struct {
	OrderIds    []int  `json:"order_ids"`
	TitleType   string `json:"title_type"`
	InvoiceType string `json:"invoice_type"`
	Remark      string `json:"remark"`
}

func GetInvoiceTitle(c *gin.Context) {
	userId := c.GetInt("id")

	var title model.InvoiceTitle
	err := model.DB.Where("user_id = ?", userId).First(&title).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "record not found",
				"data":    nil,
			})
			return
		}
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    title,
	})
}

func SaveInvoiceTitle(c *gin.Context) {
	userId := c.GetInt("id")

	var req InvoiceTitleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.Type != model.PersonaInvoice && req.Type != model.CompanyInvoice {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的抬头类型",
		})
		return
	}

	if req.Title == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请填写发票抬头",
		})
		return
	}

	if req.Email == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请填写接收邮箱",
		})
		return
	}

	if req.Type == model.CompanyInvoice && req.USCC == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "企业开票必须填写纳税人识别号",
		})
		return
	}

	var title model.InvoiceTitle
	err := model.DB.Where("user_id = ?", userId).First(&title).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}

	title.UserId = userId
	title.InvoiceType = req.Type
	title.Title = req.Title
	title.CompanyUSCC = req.USCC
	title.CompanyAddress = req.CompanyAddress
	title.CompanyPhone = req.CompanyPhone
	title.BankName = req.BankName
	title.BankAccount = req.BankAccount
	title.Email = req.Email

	if title.Id == 0 {
		err = model.DB.Create(&title).Error
	} else {
		err = model.DB.Save(&title).Error
	}

	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "保存成功",
		"data":    title,
	})
}

func GetInvoiceRecords(c *gin.Context) {
	userId := c.GetInt("id")

	pageInfo := common.GetPageQuery(c)

	var records []model.InvoiceRecord
	var total int64

	err := model.DB.Model(&model.InvoiceRecord{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	err = model.DB.Where("user_id = ?", userId).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&records).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func ApplyInvoice1(c *gin.Context) {
	userId := c.GetInt("id")

	var req InvoiceApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if len(req.OrderIds) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请选择要开票的订单",
		})
		return
	}

	var topups []model.TopUp
	err := model.DB.Where("id IN ? AND user_id = ? AND status = ?", req.OrderIds, userId, "success").Find(&topups).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if len(topups) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "订单不存在或未完成支付",
		})
		return
	}

	var title model.InvoiceTitle
	err = model.DB.Where("user_id = ?", userId).First(&title).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请先设置开票信息",
			})
			return
		}
		common.ApiError(c, err)
		return
	}

	titleInfo, _ := json.Marshal(title)

	totalAmount := 0
	for _, topup := range topups {
		totalAmount += int(topup.Amount)
	}

	orderIdsStr := ""
	for i, id := range req.OrderIds {
		if i > 0 {
			orderIdsStr += ","
		}
		orderIdsStr += fmt.Sprintf("%d", id)
	}

	invoiceType := model.GeneralInvoice
	if req.InvoiceType == "special" {
		invoiceType = model.SpecialInvoice
	}

	invoiceRecord := model.InvoiceRecord{
		UserId:           userId,
		InvoiceTitleId:   title.Id,
		InvoiceTitleInfo: string(titleInfo),
		OrderIds:         orderIdsStr,
		Amount:           totalAmount,
		Status:           model.InvoicePendingStatus,
		InvoiceType:      invoiceType,
		Remark:           req.Remark,
	}

	err = model.DB.Create(&invoiceRecord).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "开票申请成功",
		"data":    invoiceRecord,
	})
}
