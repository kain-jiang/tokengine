/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const prometheusRequestTimeout = 15 * time.Second

// prometheusProxy 将请求转发到 Prometheus 的 /api/v1/query 或 /api/v1/query_range，
// 透传 Prometheus 返回的 JSON，避免浏览器直接访问 Prometheus 的跨域问题。
func prometheusProxy(c *gin.Context, endpoint string) {
	base := strings.TrimRight(common.PrometheusURL, "/")
	if base == "" {
		common.ApiErrorMsg(c, "Prometheus 数据源未配置")
		return
	}

	target := base + "/api/v1/" + endpoint
	req, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	q := url.Values{}
	for _, key := range []string{"query", "time", "start", "end", "step"} {
		if v := c.Query(key); v != "" {
			q.Set(key, v)
		}
	}
	req.URL.RawQuery = q.Encode()

	client := &http.Client{Timeout: prometheusRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Prometheus 请求失败: %v", err))
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if resp.StatusCode != http.StatusOK {
		common.ApiErrorMsg(c, fmt.Sprintf("Prometheus 返回错误 %d: %s", resp.StatusCode, string(body)))
		return
	}

	// 透传 Prometheus 的完整 JSON 响应体
	c.Data(resp.StatusCode, "application/json", body)
}

// PrometheusQuery 代理 Prometheus 即时查询 /api/v1/query
func PrometheusQuery(c *gin.Context) {
	prometheusProxy(c, "query")
}

// PrometheusQueryRange 代理 Prometheus 范围查询 /api/v1/query_range
func PrometheusQueryRange(c *gin.Context) {
	prometheusProxy(c, "query_range")
}
