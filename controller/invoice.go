package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
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

// 获取发票抬头
func GetInvoiceTitle(c *gin.Context) {
	userId := c.GetInt("id")
	titles := make([]model.InvoiceTitle, 0)
	err := model.DB.Where("user_id = ?", userId).First(&titles).Error
	if err != nil {
		common.ApiErrorMsg(c, "用户暂未设置发票抬头")
		return
	}
	list := make([]map[string]any, 0)
	for _, item := range titles {
		titleInfo := item.ToMap()
		list = append(list, titleInfo)
	}
	common.ApiSuccess(c, list)
}

// 保存发票抬头
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
	err := model.DB.Where("user_id = ? AND invoice_type = ?", userId, req.Type).First(&title).Error
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
		logger.LogError(c, fmt.Sprintf("create data[%v] or update data failed, error detail --> %s", title, err))
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, title)
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
	list := make([]map[string]any, 0)
	for _, v := range records {
		item, err := v.ToMap()
		if err != nil {
			common.ApiErrorMsg(c, "获取开票信息失败")
			return
		}
		list = append(list, item)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// 申请开票
func SubmitInvoiceApply(c *gin.Context) {
	userId := c.GetInt("id")

	var req InvoiceApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if len(req.OrderIds) == 0 {
		common.ApiErrorMsg(c, "请选择要开票的订单")
		return
	}

	var topups []model.TopUp
	err := model.DB.Where("id IN ? AND user_id = ? AND status = ?", req.OrderIds, userId, "success").Find(&topups).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if len(topups) == 0 {
		common.ApiErrorMsg(c, "订单不存在或未完成支付")
		return
	}

	var title model.InvoiceTitle
	err = model.DB.Where("user_id = ? AND invoice_type = ? ", userId, req.TitleType).First(&title).Error
	if err != nil {
		common.ApiErrorMsg(c, "请先设置开票抬头信息")
		return
	}
	if req.TitleType == model.PersonaInvoice {
		if req.InvoiceType != "general" {
			common.ApiErrorMsg(c, "个人开票只能选择普票")
			return
		}
	}

	// 过滤掉已经开了票或正在开票的
	invoicedOrderIdMap, err := model.GetInvoicedOrderIds(userId)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("get user[%d] invoiced order ids failed, error detail --> %s", userId, err))
		common.ApiErrorMsg(c, "申请开票失败, 系统异常")
		return
	}
	var validTopups []model.TopUp
	for _, topup := range topups {
		if !invoicedOrderIdMap[topup.Id] {
			validTopups = append(validTopups, topup)
		}
	}
	fmt.Println("valid topups", validTopups)
	if len(validTopups) == 0 {
		common.ApiErrorMsg(c, "所选订单均已开票或正在开票中, 请检查")
		return
	}

	titleInfo, _ := json.Marshal(title)

	totalMoney := 0.0
	for _, topup := range validTopups {
		totalMoney += topup.Money
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
		Amount:           totalMoney,
		Status:           model.InvoicePendingStatus,
		InvoiceType:      invoiceType,
		Remark:           req.Remark,
	}

	err = model.DB.Create(&invoiceRecord).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, invoiceRecord)
}
