package model

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

type BoundChannel struct {
	Name      string `json:"name"`
	ChannelID int    `json:"id"`
	Type      int    `json:"type"`
}

type Model struct {
	Id            int            `json:"id"`
	ModelName     string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description   string         `json:"description,omitempty" gorm:"type:text"`
	Icon          string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags          string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	ModelType     int            `json:"model_type" gorm:"default:1;index"`
	VendorID      int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints     string         `json:"endpoints,omitempty" gorm:"type:text"`
	Status        int            `json:"status" gorm:"default:1"`
	IsBlacklisted int            `json:"is_blacklisted" gorm:"default:0"` // TODO 黑名单模型没有做级联删除，如果模型被删除，不会删除已被授权的用户可以调用的模型
	SyncOfficial  int            `json:"sync_official" gorm:"default:1"`
	CreatedTime   int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime   int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

func (mi *Model) Insert() error {
	now := common.GetTimestamp()
	mi.CreatedTime = now
	mi.UpdatedTime = now

	// 保存原始值（因为 Create 后可能被 GORM 的 default 标签覆盖为 1）
	originalStatus := mi.Status
	originalIsBlacklisted := mi.IsBlacklisted
	originalSyncOfficial := mi.SyncOfficial

	// 先创建记录（GORM 会对零值字段应用默认值）
	if err := DB.Create(mi).Error; err != nil {
		return err
	}

	// 使用保存的原始值进行更新，确保零值能正确保存
	return DB.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]any{
		"status":         originalStatus,
		"is_blacklisted": originalIsBlacklisted,
		"sync_official":  originalSyncOfficial,
	}).Error
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	mi.UpdatedTime = common.GetTimestamp()
	// 使用 Select 强制更新所有字段，包括零值
	return DB.Model(&Model{}).Where("id = ?", mi.Id).
		Select("model_name", "description", "icon", "tags", "model_type", "vendor_id", "endpoints", "status", "is_blacklisted", "sync_official", "name_rule", "updated_time").
		Updates(mi).Error
}

func (mi *Model) Delete() error {
	return DB.Delete(mi).Error
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

func GetAllModels(offset int, limit int, modelType *int) ([]*Model, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if modelType != nil {
		db = db.Where("model_type = ?", *modelType)
	}
	err := db.Order("id DESC").Offset(offset).Limit(limit).Find(&models).Error
	return models, err
}

func GetBoundChannelsByModelsMap(modelNames []string) (map[string][]BoundChannel, error) {
	result := make(map[string][]BoundChannel)
	if len(modelNames) == 0 {
		return result, nil
	}
	type row struct {
		Model string
		Name  string
		Id    int
		Type  int
	}
	var rows []row
	err := DB.Table("channels").
		Select("abilities.model as model, channels.name as name,  channels.id as id,channels.type as type").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ?", modelNames, true).
		Distinct().
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.Model] = append(result[r.Model], BoundChannel{Name: r.Name, ChannelID: r.Id, Type: r.Type})
	}
	return result, nil
}

func SearchModels(keyword string, vendor string, channel string, offset int, limit int, modelType *int) ([]*Model, int64, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if modelType != nil {
		db = db.Where("model_type = ?", *modelType)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if vendor != "" {
		if vid, err := strconv.Atoi(vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vid)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
		}
	}
	hasChannelFilter := false
	if channel != "" {
		if chID, err := strconv.Atoi(channel); err == nil {
			hasChannelFilter = true
			db = db.Joins("JOIN abilities ON abilities.model = models.model_name").
				Joins("JOIN channels ON channels.id = abilities.channel_id").
				Where("abilities.channel_id = ? AND abilities.enabled = ?", chID, true)
		}
	}

	var total int64
	if hasChannelFilter {
		// channel 筛选需要 DISTINCT，Count 也要对应去重
		err := DB.Model(&Model{}).Distinct("models.id").
			Joins("JOIN abilities ON abilities.model = models.model_name").
			Joins("JOIN channels ON channels.id = abilities.channel_id").
			Where("abilities.channel_id = ? AND abilities.enabled = ?", channel, true).
			Count(&total).Error
		if err != nil {
			return nil, 0, err
		}
		// 重置 db 重新构建查询
		db = DB.Model(&Model{})
		if modelType != nil {
			db = db.Where("model_type = ?", *modelType)
		}
		if keyword != "" {
			like := "%" + keyword + "%"
			db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
		}
		if vendor != "" {
			if vid, err := strconv.Atoi(vendor); err == nil {
				db = db.Where("models.vendor_id = ?", vid)
			} else {
				db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
			}
		}
		db = db.Joins("JOIN abilities ON abilities.model = models.model_name").
			Joins("JOIN channels ON channels.id = abilities.channel_id").
			Where("abilities.channel_id = ? AND abilities.enabled = ?", channel, true).
			Distinct()
	} else {
		if err := db.Count(&total).Error; err != nil {
			return nil, 0, err
		}
	}

	if err := db.Order("models.id DESC").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	return models, total, nil
}

// GetBlacklistedModelNames 返回当前已被全局黑名单标记的模型名列表
func GetBlacklistedModelNames() ([]string, error) {
	var names []string
	err := DB.Model(&Model{}).Where("is_blacklisted = ?", 1).Pluck("model_name", &names).Error
	return names, err
}

func GetModelsByNames(names []string) ([]*Model, error) {
	if len(names) == 0 {
		return []*Model{}, nil
	}
	var models []*Model
	if err := DB.Where("model_name IN ?", names).Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}
