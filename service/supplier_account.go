package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ============================================
// SupplierAccountService 供应商账户服务
// ============================================

type SupplierAccountService struct{}

var supplierAccountServiceInstance *SupplierAccountService

func GetSupplierAccountService() *SupplierAccountService {
	if supplierAccountServiceInstance == nil {
		supplierAccountServiceInstance = &SupplierAccountService{}
	}
	return supplierAccountServiceInstance
}

// GetAccountByVendor 根据供应商ID获取账户
func (s *SupplierAccountService) GetAccountByVendor(vendorId int) (*model.SupplierAccount, error) {
	return model.GetSupplierAccountByVendorId(vendorId)
}

// GetAllAccounts 获取所有账户（分页）
func (s *SupplierAccountService) GetAllAccounts(pageInfo *common.PageInfo) ([]*model.SupplierAccount, int64, error) {
	return model.GetAllSupplierAccounts(pageInfo)
}

// SearchAccounts 搜索账户
func (s *SupplierAccountService) SearchAccounts(keyword string, status string, pageInfo *common.PageInfo) ([]*model.SupplierAccount, int64, error) {
	return model.SearchSupplierAccounts(keyword, status, pageInfo)
}

// Recharge 充值
func (s *SupplierAccountService) Recharge(amount float64, vendorId int, method string, operatorId int, remark string) error {
	// 验证参数
	if amount <= 0 {
		return fmt.Errorf("充值金额必须大于0")
	}
	if vendorId == 0 {
		return fmt.Errorf("供应商ID不能为空")
	}
	if method == "" {
		return fmt.Errorf("支付方式不能为空")
	}

	// 检查供应商是否存在
	vendor, err := model.GetVendorByID(vendorId)
	if err != nil {
		return fmt.Errorf("供应商不存在")
	}

	// 创建充值记录
	recharge := &model.SupplierRecharge{
		VendorId:     vendorId,
		VendorName:   vendor.Name,
		Amount:       amount,
		Method:       method,
		OperatorId:   operatorId,
		Remark:       remark,
		Status:       model.RechargeStatusSuccess,
		CompleteTime: common.GetTimestamp(),
	}

	if err := recharge.Complete(); err != nil {
		return fmt.Errorf("创建充值记录失败: %v", err)
	}

	// 更新账户余额
	account, err := model.GetOrCreateSupplierAccount(vendorId, vendor.Name)
	if err != nil {
		// 如果账户不存在，尝试创建
		account = &model.SupplierAccount{
			VendorId:         vendorId,
			VendorName:       vendor.Name,
			Currency:         "CNY",
			Status:           model.AccountStatusActive,
			TotalRecharge:    0,
			TotalConsumption: 0,
			Balance:          0,
		}
		if err := account.Insert(); err != nil {
			return fmt.Errorf("创建账户失败: %v", err)
		}
	}

	return account.Recharge(amount)
}

// Deduct 扣费
func (s *SupplierAccountService) Deduct(vendorId int, amount float64) error {
	if amount <= 0 {
		return fmt.Errorf("扣费金额必须大于0")
	}

	account, err := model.GetSupplierAccountByVendorId(vendorId)
	if err != nil {
		return fmt.Errorf("账户不存在")
	}

	return account.Deduct(amount)
}

// UpdateBalance 更新余额
func (s *SupplierAccountService) UpdateBalance(vendorId int) error {
	account, err := model.GetSupplierAccountByVendorId(vendorId)
	if err != nil {
		return fmt.Errorf("账户不存在")
	}

	return account.UpdateBalance()
}

// GetAccountStatistics 获取账户统计信息
func (s *SupplierAccountService) GetAccountStatistics(vendorId int) (*AccountStatistics, error) {
	account, err := model.GetSupplierAccountByVendorId(vendorId)
	if err != nil {
		return nil, fmt.Errorf("账户不存在")
	}

	// 获取充值记录
	recharges, _, err := model.GetRechargesByVendor(vendorId, &common.PageInfo{
		Page:     1,
		PageSize: 1000,
	})
	if err != nil {
		recharges = []*model.SupplierRecharge{}
	}

	// 获取结算单
	settlements, _, err := model.GetSettlementsByVendor(vendorId, &common.PageInfo{
		Page:     1,
		PageSize: 1000,
	})
	if err != nil {
		settlements = []*model.SupplierSettlement{}
	}

	// 计算统计信息
	var totalRechargeRecords, totalSettlementRecords, paidSettlementRecords int
	var totalRechargeAmount, totalSettlementCost float64

	for _, r := range recharges {
		if r.Status == model.RechargeStatusSuccess {
			totalRechargeRecords++
			totalRechargeAmount += r.Amount
		}
	}

	for _, st := range settlements {
		totalSettlementRecords++
		if st.Status == model.SettlementStatusPaid {
			paidSettlementRecords++
		}
		totalSettlementCost += st.TotalCost
	}

	return &AccountStatistics{
		VendorId:               account.VendorId,
		VendorName:             account.VendorName,
		TotalRecharge:          account.TotalRecharge,
		TotalConsumption:       account.TotalConsumption,
		Balance:                account.Balance,
		TotalRechargeRecords:   totalRechargeRecords,
		TotalSettlementRecords: totalSettlementRecords,
		PaidSettlementRecords:  paidSettlementRecords,
	}, nil
}

// GetLowBalanceAccounts 获取余额低于阈值的账户
func (s *SupplierAccountService) GetLowBalanceAccounts(threshold float64) ([]*model.SupplierAccount, error) {
	return model.GetLowBalanceAccounts(threshold)
}

// ============================================
// 统计数据DTO
// ============================================

// AccountStatistics 账户统计信息
type AccountStatistics struct {
	VendorId               int     `json:"vendor_id"`
	VendorName             string  `json:"vendor_name"`
	TotalRecharge          float64 `json:"total_recharge"`
	TotalConsumption       float64 `json:"total_consumption"`
	Balance                float64 `json:"balance"`
	TotalRechargeRecords   int     `json:"total_recharge_records"`
	TotalSettlementRecords int     `json:"total_settlement_records"`
	PaidSettlementRecords  int     `json:"paid_settlement_records"`
}

// RechargeRequest 充值请求DTO
type RechargeRequest struct {
	VendorId int     `json:"vendor_id" binding:"required"`
	Amount   float64 `json:"amount" binding:"required,gt=0"`
	Method   string  `json:"method" binding:"required"`
	Remark   string  `json:"remark"`
}

// BatchUpdateRequest 批量更新请求DTO
type BatchUpdateRequest struct {
	Ids    []int  `json:"ids" binding:"required"`
	Status string `json:"status" binding:"required"`
}
