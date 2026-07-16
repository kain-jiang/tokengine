package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

const API_KEY = "sk-OAw4g3QAYHFVPUpxx8YrYz6DV4fB88tVvAqDzHaxOHx3LvMt"
const BASE_URL = "https://ai.fzjinglin.com"

func GetUUID() string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	return code
}

func createVideo() {
	body := map[string]interface{}{
		"model": "doubao-seedance-1.5-pro",
		"content": []map[string]string{
			{
				"type": "text",
				"text": "一位东亚少女在金色麦田里奔跑，无人机跟拍视角，电影级画面，日期20260101，编号01",
			},
		},
		"duration":       5,
		"ratio":          "16:9",
		"resolution":     "480p",
		"generate_audio": false,
		"watermark":      false,
		"callback_url":   "https://your-server.com/webhook",
	}
	url := BASE_URL + "/v1/video/generations"
	requestId := GetUUID()
	jsonData, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		fmt.Println("创建请求失败", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+API_KEY)
	req.Header.Set("X-Trace-ID", requestId)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("发送请求失败", err)
		return
	}
	defer resp.Body.Close()
	fmt.Println("响应状态码:", resp.StatusCode)
	result, _ := io.ReadAll(resp.Body)
	fmt.Println("响应内容:", string(result))
}

func queryVideo(taskId string) {
	url := BASE_URL + "/v1/video/generations/" + taskId
	requestId := GetUUID()
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("创建请求失败", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+API_KEY)
	req.Header.Set("X-Trace-ID", requestId)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("发送请求失败", err)
		return
	}
	defer resp.Body.Close()
	result, _ := io.ReadAll(resp.Body)
	jsonData := map[string]interface{}{}
	err = json.Unmarshal(result, &jsonData)
	fmt.Println(err)
	fmt.Println(string(result))
	fmt.Println("响应内容:", jsonData)
}
func main() {
	//taskId := "task_xs1UlLH5sc5Nx5kAoNOIdyZ9mMSXa1ca"
	//queryVideo(taskId)
	createVideo()
}
