# 📖 Ghi chú chức năng hệ thống N-SIGHT Remote Control System

## 1. Giới thiệu tổng quan

- **Tên dự án:** N-SIGHT: Remote Control System
- **Mục tiêu:** Điều khiển, giám sát máy tính từ xa qua giao diện web hiện đại, hỗ trợ đa nền tảng.
- **Thành phần:** 
  - **Client:** Web Dashboard (HTML, CSS, JS, Soft UI)
  - **Server:** C# (.NET), WebSocket, đa luồng
  - **Agent:** Máy tính mục tiêu (Target PC)

---

## 2. Chức năng chính

### 2.1. Dashboard Tổng quan

- Hiển thị trạng thái kết nối (Online/Offline, Ping, Latency)
- Thanh điều hướng các module: Dashboard, Monitor, Webcam, Audio, Process, File Manager, Terminal
- Quick Launch: Chạy nhanh ứng dụng, mở website, tìm kiếm web
- Thông tin hệ thống: OS, Hostname, CPU, Disk, GPU, VRAM
- Thống kê hiệu suất: CPU, RAM, Disk, Network (biểu đồ realtime)

---

### 2.2. Screen Monitor (Giám sát màn hình)

- **Live Stream:** Xem trực tiếp màn hình máy chủ với tốc độ khung hình cao
- **Snapshot:** Chụp ảnh màn hình, tải về máy
- **Screen Recording:** Quay video màn hình, chọn thời lượng, tải về file .webm
- **Điều khiển hiển thị:** Zoom, Fit Mode (contain/cover/fill), Fullscreen
- **Audio Stream:** Tùy chọn ghi kèm âm thanh khi quay màn hình

---

### 2.3. Webcam Surveillance (Giám sát Webcam)

- **Live Webcam:** Xem trực tiếp webcam máy chủ
- **Webcam Recording:** Ghi lại video webcam, chọn thời lượng, tải về file .webm
- **Audio:** Tùy chọn ghi kèm âm thanh webcam
- **Điều khiển hiển thị:** Zoom, Fit Mode, Fullscreen, Pan/Drag khi zoom
- **Trạng thái:** Hiển thị trạng thái webcam (Online/Offline)

---

### 2.4. Audio Recorder (Ghi âm)

- **Ghi âm:** Ghi lại âm thanh từ microphone máy chủ, chọn thời lượng
- **Quản lý bản ghi:** Danh sách các bản ghi gần đây, phát lại, đổi tên, tải về, xóa
- **Hiển thị thời lượng, trạng thái ghi âm**
- **Âm báo:** Beep countdown khi bắt đầu ghi

---

### 2.5. Process & App Manager (Quản lý tiến trình & ứng dụng)

- **Xem danh sách ứng dụng:** Liệt kê các app đang cài đặt (Start Menu)
- **Xem tiến trình:** Liệt kê các process đang chạy (PID, tên, bộ nhớ, trạng thái)
- **Thao tác:** Khởi động ứng dụng, dừng tiến trình, kill process
- **Tìm kiếm, lọc ứng dụng/process**
- **Chuyển đổi giữa chế độ xem Apps/Processes**

---

### 2.6. File Manager (Quản lý file)

- **Duyệt ổ đĩa, thư mục:** Hiển thị cây thư mục, breadcrumb, navigation
- **Xem danh sách file/folder:** Tên, loại, ngày sửa đổi, kích thước
- **Tải file về:** Download file từ server về client
- **Tải file lên:** Upload file từ client lên server (Base64)
- **Đổi tên file/thư mục:** Nút rename, nhập tên mới, cập nhật realtime
- **Xóa file/thư mục:** Nút delete, xác nhận, xóa cả thư mục và nội dung con
- **Tạo thư mục mới:** Nút "New Folder", nhập tên, tạo thư mục
- **Tìm kiếm file:** Search theo tên file/folder trong thư mục hiện tại
- **Breadcrumb:** Dẫn đường, click để quay lại các cấp thư mục trước

---

### 2.7. Keylogger & Terminal Logs

- **Keylogger:** Nhận và hiển thị log phím bấm từ máy chủ
- **Terminal Logs:** Hiển thị log hệ thống, log thao tác, log lỗi
- **Tải log:** Download log về file .txt
- **Xóa log:** Nút clear để làm sạch log trên giao diện

---

### 2.8. Power Control (Điều khiển nguồn)

- **Shutdown:** Tắt máy chủ từ xa
- **Restart:** Khởi động lại máy chủ
- **Lock:** Khóa màn hình máy chủ
- **Sleep/Hibernate:** Đưa máy chủ vào chế độ ngủ/ngủ đông

---

### 2.9. Tính năng bổ sung & UI

- **Dark/Light Mode:** Chuyển đổi giao diện sáng/tối, lưu trạng thái
- **Responsive UI:** Giao diện thích ứng mọi thiết bị, tối ưu mobile/tablet/desktop
- **Toast Notification:** Thông báo trạng thái, lỗi, thành công
- **Modal Preview:** Xem trước video, audio, hình ảnh trước khi tải về
- **Soft UI Components:** Card, Button, Badge, Breadcrumb, Table, Modal, v.v.
- **Hiệu ứng chuyển động:** Animation khi chuyển tab, mở modal, toast

---

## 3. Kiến trúc hệ thống

- **Client:** Giao diện web, gửi lệnh qua WebSocket, nhận dữ liệu JSON/Binary
- **Server:** Nhận lệnh, xử lý, gửi dữ liệu về client, quản lý đa kết nối
- **Agent:** Thực thi thao tác hệ thống, gửi dữ liệu màn hình, webcam, audio, file, process

---

## 4. Công nghệ sử dụng

- **Frontend:** HTML5, CSS3 (Soft UI, Bootstrap 5), JavaScript ES6+, Font Awesome
- **Backend:** C# (.NET 6), WebSocket, OpenCvSharp, NAudio, Newtonsoft.Json
- **Giao tiếp:** WebSocket (JSON + Binary), TCP/IP, JSON Serialization

---

## 5. Kịch bản demo gợi ý (tham khảo)

1. **Đăng nhập hệ thống, kiểm tra trạng thái kết nối**
2. **Trình diễn Dashboard tổng quan, xem thông tin hệ thống**
3. **Chuyển sang Monitor, stream màn hình, chụp ảnh, quay video màn hình**
4. **Chuyển sang Webcam, bật/tắt webcam, ghi hình, tải video**
5. **Chuyển sang Audio, ghi âm, phát lại, tải/xóa bản ghi**
6. **Quản lý tiến trình: xem, tìm kiếm, kill process, chạy app**
7. **Quản lý file: duyệt thư mục, tải lên/xuống, đổi tên, xóa, tạo mới**
8. **Xem Keylogger, Terminal Logs, tải log**
9. **Thao tác Power Control: shutdown, restart, lock**
10. **Chuyển đổi Dark/Light Mode, kiểm tra responsive UI**

---

## 6. Liên hệ & thông tin nhóm

- **Tên nhóm:** N-SIGHT Team - 24CTT5 - HCMUS
- **Email:** nsight.contact@gmail.com
- **GitHub:** https://github.com/...
- **Facebook:** https://facebook.com/...

---

*File này dùng để tổng hợp chức năng, làm tài liệu hướng dẫn, hoặc làm kịch bản demo video cho hệ thống N-SIGHT Remote Control System.*
