package common

import "os"

func GetZefengClientID() string {
	return os.Getenv("ZEFENG_CLIENT_ID")
}

func GetZefengClientSecret() string {
	return os.Getenv("ZEFENG_CLIENT_SECRET")
}

func GetZefengCarbotURL() string {
	url := os.Getenv("ZEFENG_CARBOT_URL")
	if url == "" {
		url = "https://carbotai.com/design/"
	}
	return url
}

func GetZefengAPIURL() string {
	url := os.Getenv("ZEFENG_API_URL")
	if url == "" {
		url = "https://carbotai.com/api/v1"
	}
	return url
}

func GetZefengOAuthScope() string {
	scope := os.Getenv("ZEFENG_OAUTH_SCOPE")
	if scope == "" {
		scope = "image.generate task.read"
	}
	return scope
}
