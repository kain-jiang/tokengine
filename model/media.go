package model

// 图片、

const (
	MediaTypeImage = "image"
	MediaTypeVideo = "video"
)

var MediaTypes = struct {
	MediaTypeImage string
	MediaTypeVideo string
}{MediaTypeImage: "image", MediaTypeVideo: "video"}

func (Media) TableName() string {
	return "media"
}

type Media struct {
	Id            int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId        int    `json:"user_id" gorm:"index"`
	MediaType     string `json:"media_type"`
	Filename      string `json:"filename" gorm:"type:varchar(50)"`
	Filesize      int64  `json:"filesize"`
	Url           string `json:"url" gorm:"type:varchar(255)"`
	Base64Content string `json:"base64_content" gorm:"type:text"`               // base64编码的媒体内容
	CreatedAt     int64  `json:"created_at" gorm:"type:bigint;default:0;index"` // 创建时间（Unix时间戳）
	UpdatedAt     int64  `json:"updated_at" gorm:"type:bigint;default:0;index"`
}
