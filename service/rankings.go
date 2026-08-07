package service

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	rankingCacheTTL         = 5 * time.Minute
	rankingLeaderboardLimit = 20
	rankingHistoryLimit     = 10
	rankingVendorLimit      = 5
	rankingMoverLimit       = 6
	rankingOthersLabel      = "Others"
	rankingUnknownVendor    = "Unknown"
)

type RankingsResponse struct {
	Models             []RankedModel      `json:"models"`
	Vendors            []RankedVendor     `json:"vendors"`
	TopMovers          []RankingMover     `json:"top_movers"`
	TopDroppers        []RankingMover     `json:"top_droppers"`
	ModelsHistory      ModelHistorySeries `json:"models_history"`
	VendorShareHistory VendorShareSeries  `json:"vendor_share_history"`
}

type RankedModel struct {
	Rank         int     `json:"rank"`
	PreviousRank *int    `json:"previous_rank,omitempty"`
	ModelName    string  `json:"model_name"`
	Icon         string  `json:"icon,omitempty"`
	Vendor       string  `json:"vendor"`
	VendorIcon   string  `json:"vendor_icon,omitempty"`
	TotalTokens  int64   `json:"total_tokens"`
	Share        float64 `json:"share"`
	GrowthPct    float64 `json:"growth_pct"`
}

type RankedVendor struct {
	Rank        int     `json:"rank"`
	Vendor      string  `json:"vendor"`
	VendorIcon  string  `json:"vendor_icon,omitempty"`
	TotalTokens int64   `json:"total_tokens"`
	Share       float64 `json:"share"`
	GrowthPct   float64 `json:"growth_pct"`
	ModelsCount int     `json:"models_count"`
	TopModel    string  `json:"top_model"`
}

type RankingMover struct {
	ModelName   string  `json:"model_name"`
	Icon        string  `json:"icon,omitempty"`
	Vendor      string  `json:"vendor"`
	VendorIcon  string  `json:"vendor_icon,omitempty"`
	RankDelta   int     `json:"rank_delta"`
	CurrentRank int     `json:"current_rank"`
	GrowthPct   float64 `json:"growth_pct"`
}

type ModelHistoryPoint struct {
	Ts     string `json:"ts"`
	Label  string `json:"label"`
	Model  string `json:"model"`
	Vendor string `json:"vendor"`
	Tokens int64  `json:"tokens"`
}

type ModelHistorySeries struct {
	Points  []ModelHistoryPoint `json:"points"`
	Models  []ModelHistoryModel `json:"models"`
	Buckets int                 `json:"buckets"`
}

type ModelHistoryModel struct {
	Name   string `json:"name"`
	Vendor string `json:"vendor"`
	Total  int64  `json:"total"`
}

type VendorSharePoint struct {
	Ts     string  `json:"ts"`
	Label  string  `json:"label"`
	Vendor string  `json:"vendor"`
	Share  float64 `json:"share"`
	Tokens int64   `json:"tokens"`
}

type VendorShareSeries struct {
	Points  []VendorSharePoint  `json:"points"`
	Vendors []VendorShareVendor `json:"vendors"`
	Buckets int                 `json:"buckets"`
}

type VendorShareVendor struct {
	Name  string  `json:"name"`
	Total int64   `json:"total"`
	Share float64 `json:"share"`
}

type rankingPeriodConfig struct {
	id          string
	duration    time.Duration
	bucketSize  int64
	labelLayout string
}

type rankingCacheItem struct {
	expiresAt time.Time
	data      *RankingsResponse
}

type rankingModelMeta struct {
	icon       string
	vendor     string
	vendorIcon string
}

type rankingModelMetaRule struct {
	modelName string
	meta      rankingModelMeta
}

type rankingModelMetaResolver struct {
	exact    map[string]rankingModelMeta
	prefix   []rankingModelMetaRule
	suffix   []rankingModelMetaRule
	contains []rankingModelMetaRule
}

type vendorAggregate struct {
	name           string
	icon           string
	totalTokens    int64
	previousTokens int64
	models         map[string]struct{}
	topModel       string
	topModelTokens int64
}

var (
	rankingCacheMu sync.Mutex
	rankingCache   = map[string]rankingCacheItem{}
)

func GetRankingsSnapshot(period string) (*RankingsResponse, error) {
	config, err := rankingConfig(period)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	cacheKey := config.id
	rankingCacheMu.Lock()
	if item, ok := rankingCache[cacheKey]; ok && now.Before(item.expiresAt) {
		rankingCacheMu.Unlock()
		return item.data, nil
	}
	rankingCacheMu.Unlock()

	data, err := buildRankingsSnapshot(config, now)
	if err != nil {
		return nil, err
	}
	if len(data.Models) > 0 {
		rankingCacheMu.Lock()
		rankingCache[cacheKey] = rankingCacheItem{expiresAt: now.Add(rankingCacheTTL), data: data}
		rankingCacheMu.Unlock()
	}
	return data, nil
}

func rankingConfig(period string) (rankingPeriodConfig, error) {
	switch period {
	case "", "week":
		return rankingPeriodConfig{id: "week", duration: 7 * 24 * time.Hour, bucketSize: 24 * 3600, labelLayout: "Jan 2"}, nil
	case "today":
		return rankingPeriodConfig{id: "today", duration: 24 * time.Hour, bucketSize: 3600, labelLayout: "01-02 15:04"}, nil
	case "month":
		return rankingPeriodConfig{id: "month", duration: 30 * 24 * time.Hour, bucketSize: 24 * 3600, labelLayout: "Jan 2"}, nil
	case "year":
		return rankingPeriodConfig{id: "year", duration: 365 * 24 * time.Hour, bucketSize: 7 * 24 * 3600, labelLayout: "Jan 2"}, nil
	default:
		return rankingPeriodConfig{}, fmt.Errorf("invalid ranking period: %s", period)
	}
}

func buildRankingsSnapshot(config rankingPeriodConfig, now time.Time) (*RankingsResponse, error) {
	startTime, endTime := rankingTimeRange(config, now)
	currentTotals, err := model.GetRankingTokenTotals(startTime, endTime)
	if err != nil {
		return nil, err
	}
	currentBuckets, err := model.GetRankingTokenBuckets(startTime, endTime, config.bucketSize)
	if err != nil {
		return nil, err
	}
	previousStart, previousEnd := previousRankingTimeRange(config, startTime)
	previousTotals, err := model.GetRankingTokenTotals(previousStart, previousEnd)
	if err != nil {
		return nil, err
	}

	meta, err := buildRankingModelMeta()
	if err != nil {
		return nil, err
	}
	totalTokens := sumRankingTokens(currentTotals)
	models := buildRankedModels(currentTotals, totalTokens, rankingRankMap(previousTotals), rankingTokenMap(previousTotals), meta)
	vendors := buildRankedVendors(currentTotals, previousTotals, totalTokens, meta)
	movers, droppers := buildRankingMovers(models)
	return &RankingsResponse{
		Models:             limitRankedModels(models, rankingLeaderboardLimit),
		Vendors:            vendors,
		TopMovers:          movers,
		TopDroppers:        droppers,
		ModelsHistory:      buildModelHistory(currentBuckets, currentTotals, meta, config),
		VendorShareHistory: buildVendorShareHistory(currentBuckets, vendors, totalTokens, meta, config),
	}, nil
}

func rankingTimeRange(config rankingPeriodConfig, now time.Time) (int64, int64) {
	return now.Add(-config.duration).Unix(), now.Unix()
}

func previousRankingTimeRange(config rankingPeriodConfig, currentStart int64) (int64, int64) {
	previousEnd := currentStart - 1
	return time.Unix(currentStart, 0).Add(-config.duration).Unix(), previousEnd
}

func buildRankingModelMeta() (*rankingModelMetaResolver, error) {
	rows, err := model.GetRankingModelMetadata()
	if err != nil {
		return nil, err
	}
	resolver := &rankingModelMetaResolver{
		exact: make(map[string]rankingModelMeta, len(rows)),
	}
	for _, row := range rows {
		if row.ModelName == "" {
			continue
		}
		vendorName := row.VendorName
		if vendorName == "" {
			vendorName = rankingUnknownVendor
		}
		meta := rankingModelMeta{
			icon:       row.Icon,
			vendor:     vendorName,
			vendorIcon: row.VendorIcon,
		}
		rule := rankingModelMetaRule{modelName: row.ModelName, meta: meta}
		switch row.NameRule {
		case model.NameRulePrefix:
			resolver.prefix = append(resolver.prefix, rule)
		case model.NameRuleSuffix:
			resolver.suffix = append(resolver.suffix, rule)
		case model.NameRuleContains:
			resolver.contains = append(resolver.contains, rule)
		default:
			resolver.exact[row.ModelName] = meta
		}
	}
	return resolver, nil
}

func modelMeta(modelName string, resolver *rankingModelMetaResolver) rankingModelMeta {
	if resolver == nil {
		return rankingModelMeta{vendor: rankingUnknownVendor}
	}
	if item, ok := resolver.exact[modelName]; ok && item.vendor != "" {
		return item
	}
	for _, rule := range resolver.prefix {
		if rule.modelName != "" && strings.HasPrefix(modelName, rule.modelName) {
			resolver.exact[modelName] = rule.meta
			return rule.meta
		}
	}
	for _, rule := range resolver.suffix {
		if rule.modelName != "" && strings.HasSuffix(modelName, rule.modelName) {
			resolver.exact[modelName] = rule.meta
			return rule.meta
		}
	}
	for _, rule := range resolver.contains {
		if rule.modelName != "" && strings.Contains(modelName, rule.modelName) {
			resolver.exact[modelName] = rule.meta
			return rule.meta
		}
	}
	return rankingModelMeta{vendor: rankingUnknownVendor}
}

func buildRankedModels(totals []model.RankingTokenTotal, totalTokens int64, previousRanks map[string]int, previousTokens map[string]int64, meta *rankingModelMetaResolver) []RankedModel {
	rows := make([]RankedModel, 0, len(totals))
	for idx, item := range totals {
		info := modelMeta(item.ModelName, meta)
		var previousRank *int
		if rank, ok := previousRanks[item.ModelName]; ok {
			rankCopy := rank
			previousRank = &rankCopy
		}
		rows = append(rows, RankedModel{
			Rank: idx + 1, PreviousRank: previousRank, ModelName: item.ModelName,
			Icon: info.icon, Vendor: info.vendor, VendorIcon: info.vendorIcon, TotalTokens: item.TotalTokens,
			Share: rankingShare(item.TotalTokens, totalTokens), GrowthPct: rankingGrowthPct(item.TotalTokens, previousTokens[item.ModelName]),
		})
	}
	return rows
}

func buildRankedVendors(currentTotals []model.RankingTokenTotal, previousTotals []model.RankingTokenTotal, totalTokens int64, meta *rankingModelMetaResolver) []RankedVendor {
	aggregates := make(map[string]*vendorAggregate)
	for _, item := range currentTotals {
		info := modelMeta(item.ModelName, meta)
		agg := ensureVendorAggregate(aggregates, info)
		agg.totalTokens += item.TotalTokens
		agg.models[item.ModelName] = struct{}{}
		if item.TotalTokens > agg.topModelTokens {
			agg.topModel, agg.topModelTokens = item.ModelName, item.TotalTokens
		}
	}
	for _, item := range previousTotals {
		agg := ensureVendorAggregate(aggregates, modelMeta(item.ModelName, meta))
		agg.previousTokens += item.TotalTokens
	}
	rows := make([]RankedVendor, 0, len(aggregates))
	for _, agg := range aggregates {
		if agg.totalTokens <= 0 {
			continue
		}
		rows = append(rows, RankedVendor{
			Vendor: agg.name, VendorIcon: agg.icon, TotalTokens: agg.totalTokens,
			Share: rankingShare(agg.totalTokens, totalTokens), GrowthPct: rankingGrowthPct(agg.totalTokens, agg.previousTokens),
			ModelsCount: len(agg.models), TopModel: agg.topModel,
		})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].TotalTokens > rows[j].TotalTokens })
	for idx := range rows {
		rows[idx].Rank = idx + 1
	}
	return rows
}

func ensureVendorAggregate(aggregates map[string]*vendorAggregate, meta rankingModelMeta) *vendorAggregate {
	name := meta.vendor
	if name == "" {
		name = rankingUnknownVendor
	}
	agg, ok := aggregates[name]
	if !ok {
		agg = &vendorAggregate{name: name, icon: meta.vendorIcon, models: make(map[string]struct{})}
		aggregates[name] = agg
	}
	if agg.icon == "" && meta.vendorIcon != "" {
		agg.icon = meta.vendorIcon
	}
	return agg
}

func buildModelHistory(buckets []model.RankingTokenBucket, totals []model.RankingTokenTotal, meta *rankingModelMetaResolver, config rankingPeriodConfig) ModelHistorySeries {
	topModels := make(map[string]struct{})
	models := make([]ModelHistoryModel, 0, minInt(len(totals), rankingHistoryLimit)+1)
	var otherTotal int64
	for idx, item := range totals {
		if idx < rankingHistoryLimit {
			topModels[item.ModelName] = struct{}{}
			models = append(models, ModelHistoryModel{Name: item.ModelName, Vendor: modelMeta(item.ModelName, meta).vendor, Total: item.TotalTokens})
			continue
		}
		otherTotal += item.TotalTokens
	}
	if otherTotal > 0 {
		models = append(models, ModelHistoryModel{Name: rankingOthersLabel, Vendor: "Various", Total: otherTotal})
	}
	bucketSet := make(map[int64]struct{})
	tokensByBucketAndModel := make(map[int64]map[string]int64)
	for _, item := range buckets {
		modelName := item.ModelName
		if _, ok := topModels[modelName]; !ok {
			modelName = rankingOthersLabel
		}
		bucketSet[item.Bucket] = struct{}{}
		if _, ok := tokensByBucketAndModel[item.Bucket]; !ok {
			tokensByBucketAndModel[item.Bucket] = make(map[string]int64)
		}
		tokensByBucketAndModel[item.Bucket][modelName] += item.Tokens
	}
	sortedBuckets := sortedRankingBuckets(bucketSet)
	points := make([]ModelHistoryPoint, 0, len(sortedBuckets)*len(models))
	for _, bucket := range sortedBuckets {
		for _, historyModel := range models {
			tokens := tokensByBucketAndModel[bucket][historyModel.Name]
			if tokens > 0 {
				points = append(points, ModelHistoryPoint{Ts: time.Unix(bucket, 0).UTC().Format(time.RFC3339), Label: time.Unix(bucket, 0).Format(config.labelLayout), Model: historyModel.Name, Vendor: historyModel.Vendor, Tokens: tokens})
			}
		}
	}
	return ModelHistorySeries{Points: points, Models: models, Buckets: len(sortedBuckets)}
}

func buildVendorShareHistory(buckets []model.RankingTokenBucket, vendors []RankedVendor, totalTokens int64, meta *rankingModelMetaResolver, config rankingPeriodConfig) VendorShareSeries {
	topVendors := make(map[string]struct{})
	vendorRows := make([]VendorShareVendor, 0, minInt(len(vendors), rankingVendorLimit)+1)
	var otherTotal int64
	for idx, vendor := range vendors {
		if idx < rankingVendorLimit {
			topVendors[vendor.Vendor] = struct{}{}
			vendorRows = append(vendorRows, VendorShareVendor{Name: vendor.Vendor, Total: vendor.TotalTokens, Share: vendor.Share})
		} else {
			otherTotal += vendor.TotalTokens
		}
	}
	if otherTotal > 0 {
		vendorRows = append(vendorRows, VendorShareVendor{Name: rankingOthersLabel, Total: otherTotal, Share: rankingShare(otherTotal, totalTokens)})
	}
	bucketSet := make(map[int64]struct{})
	tokensByBucketAndVendor := make(map[int64]map[string]int64)
	totalsByBucket := make(map[int64]int64)
	for _, item := range buckets {
		vendorName := modelMeta(item.ModelName, meta).vendor
		if _, ok := topVendors[vendorName]; !ok {
			vendorName = rankingOthersLabel
		}
		bucketSet[item.Bucket] = struct{}{}
		if _, ok := tokensByBucketAndVendor[item.Bucket]; !ok {
			tokensByBucketAndVendor[item.Bucket] = make(map[string]int64)
		}
		tokensByBucketAndVendor[item.Bucket][vendorName] += item.Tokens
		totalsByBucket[item.Bucket] += item.Tokens
	}
	sortedBuckets := sortedRankingBuckets(bucketSet)
	points := make([]VendorSharePoint, 0, len(sortedBuckets)*len(vendorRows))
	for _, bucket := range sortedBuckets {
		for _, vendor := range vendorRows {
			tokens := tokensByBucketAndVendor[bucket][vendor.Name]
			if tokens > 0 {
				points = append(points, VendorSharePoint{Ts: time.Unix(bucket, 0).UTC().Format(time.RFC3339), Label: time.Unix(bucket, 0).Format(config.labelLayout), Vendor: vendor.Name, Share: rankingShare(tokens, totalsByBucket[bucket]), Tokens: tokens})
			}
		}
	}
	return VendorShareSeries{Points: points, Vendors: vendorRows, Buckets: len(sortedBuckets)}
}

func buildRankingMovers(models []RankedModel) ([]RankingMover, []RankingMover) {
	movers := make([]RankingMover, 0)
	droppers := make([]RankingMover, 0)
	for _, item := range models {
		if item.PreviousRank == nil {
			continue
		}
		delta := *item.PreviousRank - item.Rank
		if delta == 0 {
			continue
		}
		row := RankingMover{ModelName: item.ModelName, Icon: item.Icon, Vendor: item.Vendor, VendorIcon: item.VendorIcon, RankDelta: delta, CurrentRank: item.Rank, GrowthPct: item.GrowthPct}
		if delta > 0 {
			movers = append(movers, row)
		} else {
			droppers = append(droppers, row)
		}
	}
	sort.Slice(movers, func(i, j int) bool { return movers[i].RankDelta > movers[j].RankDelta })
	sort.Slice(droppers, func(i, j int) bool { return droppers[i].RankDelta < droppers[j].RankDelta })
	return limitRankingMovers(movers, rankingMoverLimit), limitRankingMovers(droppers, rankingMoverLimit)
}

func sortedRankingBuckets(bucketSet map[int64]struct{}) []int64 {
	buckets := make([]int64, 0, len(bucketSet))
	for bucket := range bucketSet {
		buckets = append(buckets, bucket)
	}
	sort.Slice(buckets, func(i, j int) bool { return buckets[i] < buckets[j] })
	return buckets
}

func rankingRankMap(totals []model.RankingTokenTotal) map[string]int {
	ranks := make(map[string]int, len(totals))
	for idx, item := range totals {
		ranks[item.ModelName] = idx + 1
	}
	return ranks
}

func rankingTokenMap(totals []model.RankingTokenTotal) map[string]int64 {
	tokens := make(map[string]int64, len(totals))
	for _, item := range totals {
		tokens[item.ModelName] = item.TotalTokens
	}
	return tokens
}

func sumRankingTokens(totals []model.RankingTokenTotal) int64 {
	var total int64
	for _, item := range totals {
		total += item.TotalTokens
	}
	return total
}

func rankingShare(value int64, total int64) float64 {
	if value <= 0 || total <= 0 {
		return 0
	}
	return roundRankingFloat(float64(value) / float64(total))
}

func rankingGrowthPct(current int64, previous int64) float64 {
	if previous <= 0 {
		if current > 0 {
			return 100
		}
		return 0
	}
	return roundRankingFloat((float64(current-previous) / float64(previous)) * 100)
}

func roundRankingFloat(value float64) float64 { return math.Round(value*10000) / 10000 }

func limitRankedModels(rows []RankedModel, limit int) []RankedModel {
	if limit <= 0 || len(rows) <= limit {
		return rows
	}
	return rows[:limit]
}

func limitRankingMovers(rows []RankingMover, limit int) []RankingMover {
	if limit <= 0 || len(rows) <= limit {
		return rows
	}
	return rows[:limit]
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
