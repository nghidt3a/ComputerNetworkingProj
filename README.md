# N-SIGHT: Remote Control System

<div align="center">

![Project Logo](Client/assets/team/nsight-logo.svg)

**Đồ án môn học Mạng Máy Tính - Lớp 24CTT5 - HCMUS**

[![.NET](https://img.shields.io/badge/.NET-6.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![WebSocket](https://img.shields.io/badge/Protocol-WebSocket-4F4F4F)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Mục Lục

- [Giới Thiệu](#-giới-thiệu)
- [Tính Năng](#-tính-năng)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt & Chạy](#-cài-đặt--chạy)
- [Hướng Dẫn Sử Dụng](#-hướng-dẫn-sử-dụng)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Thành Viên Nhóm](#-thành-viên-nhóm)
- [Liên Hệ](#-liên-hệ)

---

## 🎯 Giới Thiệu

**N-SIGHT** là ứng dụng điều khiển máy tính từ xa được xây dựng bằng C# (Server) và Web-based Client (HTML, CSS, JavaScript). Hệ thống cho phép người dùng giám sát và thực thi nhiều tác vụ trên máy chủ từ xa thông qua giao diện web trực quan.

### Thành phần hệ thống:
- **Client:** Web Dashboard (HTML, CSS, JS, Soft UI)
- **Server:** C# (.NET 6), WebSocket, đa luồng
- **Agent:** Máy tính mục tiêu (Target PC)

---

## 🚀 Tính Năng

### 📊 Dashboard & Giám Sát Hệ Thống
- Theo dõi hiệu suất **CPU, RAM, GPU, Disk** trong thời gian thực
- Hiển thị trạng thái kết nối (Online/Offline, Ping, Latency)
- Thông tin hệ thống: OS, Hostname, CPU, GPU, VRAM
- Biểu đồ thống kê hiệu suất realtime

### 🖥️ Screen Monitor
- **Live Stream:** Xem trực tiếp màn hình với tốc độ khung hình cao
- **Snapshot:** Chụp ảnh màn hình, tải về máy
- **Recording:** Quay video màn hình, chọn thời lượng, tải về `.webm`
- **Điều khiển:** Zoom, Fit Mode (contain/cover/fill), Fullscreen

### 📸 Webcam Surveillance
- Xem trực tiếp webcam máy chủ
- Ghi lại video webcam, tải về `.webm`
- Tùy chọn ghi kèm âm thanh

### 🎤 Audio Recorder
- Ghi âm từ microphone máy chủ
- Quản lý bản ghi: phát lại, đổi tên, tải về, xóa

### 📂 File Manager
| Tính năng | Mô tả |
|-----------|-------|
| 🔍 Duyệt | Duyệt cây thư mục và các ổ đĩa |
| ⬆️ Upload | Tải file từ client lên server |
| ⬇️ Download | Tải file từ server về client |
| ✏️ Rename | Đổi tên file và thư mục |
| 🗑️ Delete | Xóa file/thư mục (bao gồm cả nội dung) |
| 📁 New Folder | Tạo thư mục mới |

### ⚙️ Process & App Manager
- Xem danh sách ứng dụng đang cài đặt
- Liệt kê các process đang chạy (PID, tên, bộ nhớ)
- Khởi động ứng dụng, dừng tiến trình, kill process

### ⌨️ Keylogger & Terminal Logs
- Nhận và hiển thị log phím bấm
- Log hệ thống, log thao tác, log lỗi
- Tải log về file `.txt`

### ⚡ Power Control
- **Shutdown:** Tắt máy từ xa
- **Restart:** Khởi động lại
- **Lock:** Khóa màn hình
- **Sleep/Hibernate:** Chế độ ngủ/ngủ đông

### 🎨 Giao Diện
- **Dark/Light Mode:** Chuyển đổi giao diện
- **Responsive UI:** Thích ứng mọi thiết bị
- **Toast Notification:** Thông báo trạng thái

---

## 💻 Công Nghệ Sử Dụng

### Server (Backend)
| Công nghệ | Mô tả |
|-----------|-------|
| .NET 6 | Framework chính |
| C# | Ngôn ngữ lập trình |
| System.Net.WebSockets | Giao tiếp real-time |
| System.Text.Json | Tuần tự hóa dữ liệu |
| OpenCvSharp | Xử lý webcam |
| NAudio | Xử lý âm thanh |

### Client (Frontend)
| Công nghệ | Mô tả |
|-----------|-------|
| HTML5, CSS3 | Cấu trúc & giao diện |
| JavaScript ES6+ | Logic xử lý |
| Bootstrap 5 | Framework UI |
| Font Awesome 6 | Icons |
| Chart.js | Biểu đồ hiệu suất |

### Giao Thức
- **WebSocket** (`ws://`) - Giao tiếp real-time TCP/IP
- **JSON** - Định dạng dữ liệu

---

## 📦 Yêu Cầu Hệ Thống

### Server (Máy được điều khiển)
- **OS:** Windows 10/11
- **Runtime:** .NET 6 SDK hoặc Runtime
- **RAM:** Tối thiểu 4GB
- **Phần cứng:** Webcam, Microphone (tùy chọn)

### Client (Máy điều khiển)
- **Trình duyệt:** Chrome, Firefox, Edge (phiên bản mới nhất)
- **Kết nối:** Cùng mạng LAN hoặc có thể truy cập IP của Server

---

## 🔧 Cài Đặt & Chạy

### Bước 1: Clone Repository

```bash
git clone https://github.com/your-repo/ComputerNetworkingProj.git
cd ComputerNetworkingProj
```

### Bước 2: Chạy Server

**Cách 1: Sử dụng Visual Studio**
1. Mở file `TestNewWeb.sln` bằng Visual Studio 2022
2. Chọn Build → Build Solution (hoặc `Ctrl+Shift+B`)
3. Nhấn `F5` để chạy hoặc `Ctrl+F5` để chạy không debug

**Cách 2: Sử dụng .NET CLI (Command Line)**
```bash
cd Server
dotnet restore
dotnet build
dotnet run
```

> ⚠️ **Lưu ý:** Server mặc định sẽ lắng nghe tại `ws://localhost:8181`

### Bước 3: Chạy Client

**Cách 1: Sử dụng Live Server (Khuyến nghị)**
1. Mở VS Code
2. Cài extension **Live Server** (nếu chưa có)
3. Mở thư mục `Client`
4. Click chuột phải vào `index.html` → **Open with Live Server**

**Cách 2: Mở trực tiếp**
- Mở file `Client/index.html` bằng trình duyệt web

### Bước 4: Kết Nối
1. Nhập **IP Address** của máy Server (ví dụ: `192.168.1.100` hoặc `localhost`)
2. Nhập **Port:** `8181`
3. Nhập **Password** (nếu có cấu hình)
4. Nhấn **Connect**

---

## 📖 Hướng Dẫn Sử Dụng

### Kịch Bản Demo

1. **Đăng nhập** - Kiểm tra trạng thái kết nối
2. **Dashboard** - Xem thông tin hệ thống, biểu đồ hiệu suất
3. **Screen Monitor** - Stream màn hình, chụp ảnh, quay video
4. **Webcam** - Bật webcam, ghi hình, tải video
5. **Audio** - Ghi âm, phát lại, tải/xóa bản ghi
6. **Process Manager** - Xem, tìm kiếm, kill process
7. **File Manager** - Duyệt, upload/download, đổi tên, xóa
8. **Terminal Logs** - Xem log, tải log
9. **Power Control** - Shutdown, restart, lock

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│                 │  ◀──────────────▶ │                 │
│     Client      │    JSON/Binary    │     Server      │
│  (Web Browser)  │                   │   (C# .NET 6)   │
│                 │                   │                 │
└─────────────────┘                   └─────────────────┘
        │                                     │
        │                                     │
        ▼                                     ▼
 ┌─────────────┐                    ┌─────────────────┐
 │   User      │                    │  Target Machine │
 │   Actions   │                    │  (Screen, Cam,  │
 │             │                    │   Audio, Files) │
 └─────────────┘                    └─────────────────┘
```

### Luồng Giao Tiếp
- **Client → Server:** Gửi lệnh điều khiển qua WebSocket (JSON)
- **Server → Client:** Trả về dữ liệu hệ thống, media (JSON/Binary)
- **Server:** Xử lý lệnh, quản lý đa kết nối, thực thi thao tác hệ thống

---

## 📁 Cấu Trúc Thư Mục

```
ComputerNetworkingProj/
├── Client/                 # Web-based Client
│   ├── assets/            # Images, icons, fonts
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── index.html         # Entry point
├── Server/                 # C# Server
│   ├── Handlers/          # Request handlers
│   ├── Services/          # Business logic
│   └── Program.cs         # Entry point
├── TestNewWeb.sln          # Visual Studio Solution
└── README.md               # This file
```

---

| STT | Họ và Tên | Vai trò | MSSV |
|:---:|-----------|---------|------|
| 1 | *(Cập nhật)* | Nhóm trưởng | - |
| 2 | *(Cập nhật)* | Backend Developer | - |
| 3 | *(Cập nhật)* | Frontend Developer | - |
| 4 | *(Cập nhật)* | Tester | - |

---

## 📞 Liên Hệ

- **Nhóm:** N-SIGHT Team - 24CTT5 - HCMUS
- **Email:** nsight.contact@gmail.com

---

<div align="center">

**Made with 🤖 by N-SIGHT Team**

*Đồ án môn học Mạng Máy Tính - 2025*

</div>