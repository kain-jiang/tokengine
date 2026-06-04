package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// isAPIPath checks if the request path should be handled by API routes, not static files
func isAPIPath(path string) bool {
	return strings.HasPrefix(path, "/v1") ||
		strings.HasPrefix(path, "/api") ||
		strings.HasPrefix(path, "/backend-api") ||
		strings.HasPrefix(path, "/mj") ||
		strings.HasPrefix(path, "/pg") ||
		strings.HasPrefix(path, "/kling") ||
		strings.HasPrefix(path, "/jimeng")
}

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	// Apply global middleware first
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	// Create static file handler with API path skipping
	staticFS := common.EmbedFolder(buildFS, "web/dist")
	router.Use(func(c *gin.Context) {
		// Skip static file serving for API paths
		if isAPIPath(c.Request.RequestURI) {
			c.Next()
			return
		}
		// Use gin-contrib/static to serve files
		static.Serve("/", staticFS)(c)
	})

	// Handle 404 for unmatched routes (SPA fallback)
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		// API paths that didn't match any route should return JSON 404
		if isAPIPath(c.Request.RequestURI) {
			controller.RelayNotFound(c)
			return
		}
		// For non-API paths, serve the SPA index.html (SPA fallback)
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}
