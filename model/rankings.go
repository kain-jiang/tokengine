package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type RankingTokenTotal struct {
	ModelName   string `json:"model_name"`
	TotalTokens int64  `json:"total_tokens"`
}

type RankingTokenBucket struct {
	ModelName string `json:"model_name"`
	Bucket    int64  `json:"bucket"`
	Tokens    int64  `json:"tokens"`
}

type RankingModelMetadata struct {
	ModelName  string
	Icon       string
	VendorName string
	VendorIcon string
	NameRule   int
}

// GetRankingTokenTotals reads consume logs so rankings work independently of
// the optional quota_data export job.
func GetRankingTokenTotals(startTime int64, endTime int64) ([]RankingTokenTotal, error) {
	var rows []RankingTokenTotal
	tokenSumExpr := "COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0)"
	query := LOG_DB.Model(&Log{}).
		Select("model_name, "+tokenSumExpr+" AS total_tokens").
		Where("type = ? AND model_name <> ''", LogTypeConsume).
		Group("model_name").
		Having(tokenSumExpr + " > 0").
		Order("total_tokens DESC")
	query = applyRankingTimeRange(query, startTime, endTime)
	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func GetRankingTokenBuckets(startTime int64, endTime int64, bucketSize int64) ([]RankingTokenBucket, error) {
	if bucketSize <= 0 {
		bucketSize = 3600
	}
	bucketExpr := rankingBucketExpr(bucketSize)
	tokenSumExpr := "COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0)"
	var rows []RankingTokenBucket
	query := LOG_DB.Model(&Log{}).
		Select(fmt.Sprintf("model_name, %s AS bucket, %s AS tokens", bucketExpr, tokenSumExpr)).
		Where("type = ? AND model_name <> ''", LogTypeConsume).
		Group(fmt.Sprintf("model_name, %s", bucketExpr)).
		Having(tokenSumExpr + " > 0").
		Order("bucket ASC")
	query = applyRankingTimeRange(query, startTime, endTime)
	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func GetRankingModelMetadata() ([]RankingModelMetadata, error) {
	var models []Model
	if err := DB.Select("model_name", "icon", "vendor_id", "name_rule").Find(&models).Error; err != nil {
		return nil, err
	}
	var vendors []Vendor
	if err := DB.Select("id", "name", "icon").Find(&vendors).Error; err != nil {
		return nil, err
	}
	vendorsByID := make(map[int]Vendor, len(vendors))
	for _, vendor := range vendors {
		vendorsByID[vendor.Id] = vendor
	}
	rows := make([]RankingModelMetadata, 0, len(models))
	for _, item := range models {
		row := RankingModelMetadata{
			ModelName: item.ModelName,
			Icon:      item.Icon,
			NameRule:  item.NameRule,
		}
		if vendor, ok := vendorsByID[item.VendorID]; ok {
			row.VendorName = vendor.Name
			row.VendorIcon = vendor.Icon
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func rankingBucketExpr(bucketSize int64) string {
	if common.LogSqlType == common.DatabaseTypeMySQL {
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSize, bucketSize)
	}
	return fmt.Sprintf("(created_at / %d) * %d", bucketSize, bucketSize)
}

func applyRankingTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}
