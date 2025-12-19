# N-SIGHT: Remote Control System

**Đồ án môn học Mạng Máy Tính - Lớp 24CTT5**

Đây là một ứng dụng điều khiển máy tính từ xa được xây dựng bằng C# (Server) và Web-based Client (HTML, CSS, JavaScript). Hệ thống cho phép người dùng giám sát và thực thi nhiều tác vụ trên máy chủ từ xa thông qua giao diện web trực quan.

![Project Logo](Client/assets/team/nsight-logo.svg)

---

## 🚀 Tính Năng Chính

- **🖥️ Giám sát Hệ thống**: Theo dõi hiệu suất CPU, RAM, GPU, và ổ đĩa trong thời gian thực.
- **📺 Điều khiển Màn hình**: Stream màn hình máy chủ, chụp ảnh và quay video màn hình.
- **📸 Quản lý Webcam**: Stream video từ webcam, ghi lại video.
- **🎤 Ghi Âm**: Ghi lại âm thanh từ microphone của máy chủ.
- **📂 Quản lý File**:
  - Duyệt cây thư mục và các ổ đĩa.
  - Đổi tên file và thư mục.
  - Xóa file và thư mục (bao gồm cả nội dung bên trong).
  - Tải file từ máy khách lên máy chủ.
  - Tải file từ máy chủ xuống máy khách.
- **⚙️ Quản lý Tác vụ**: Xem và dừng các ứng dụng, tiến trình đang chạy.
- **⌨️ Keylogger**: Ghi lại các phím được gõ trên máy chủ.
- **⚡ Tác vụ Nhanh**:
  - Điều khiển nguồn (Tắt máy, Khởi động lại).
  - Chạy nhanh ứng dụng hoặc mở website.
- **🎨 Giao diện Hiện đại**: Hỗ trợ Dark Mode và có thể tùy chỉnh.
- **📝 Logging Chuyên nghiệp**: Hệ thống log được mã hóa màu sắc và biểu tượng rõ ràng ở cả Client và Server, giúp dễ dàng debug.

---

## 🛠️ Chi Tiết Tính Năng File Manager

Các tính năng nâng cao của File Manager đã được tích hợp để mang lại trải nghiệm quản lý file toàn diện.

### 1. **Đổi Tên File (Rename File)** ✅
- **Giao diện**: Nút "Rename" (biểu tượng bút) ở mỗi file.
- **Cách sử dụng**: Click vào nút rename, nhập tên mới, hệ thống sẽ gửi lệnh `RENAME_FILE` tới server.

### 2. **Đổi Tên Thư Mục (Rename Folder)** ✅
- **Giao diện**: Nút "Rename" (biểu tượng bút) ở mỗi thư mục.
- **Cách sử dụng**: Click vào nút rename của thư mục, nhập tên mới, gửi lệnh `RENAME_FOLDER`.

### 3. **Xóa Thư Mục (Delete Folder)** ✅
- **Giao diện**: Nút "Delete" (biểu tượng thùng rác) ở mỗi thư mục.
- **Cách sử dụng**: Click vào nút delete, xác nhận, gửi lệnh `DELETE_FOLDER` để xóa thư mục và tất cả nội dung bên trong.

### 4. **Tải File Lên (Upload File)** ✅
- **Giao diện**: Nút "Upload" trên thanh công cụ của File Manager.
- **Cách sử dụng**:
  - Click nút "Upload" và chọn file từ máy tính.
  - File sẽ được chuyển đổi thành Base64 và gửi lên server qua lệnh `UPLOAD_FILE`.

### Cấu Trúc Giao Tiếp (Client → Server)

```javascript
// Rename File
SocketService.send("RENAME_FILE", JSON.stringify({ path, newName }));

// Rename Folder
SocketService.send("RENAME_FOLDER", JSON.stringify({ path, newName }));

// Delete Folder
SocketService.send("DELETE_FOLDER", folderPath);

// Upload File
SocketService.send("UPLOAD_FILE", JSON.stringify({ path, fileName, data }));
```

---

## 💻 Công Nghệ Sử Dụng

- **Server**: .NET 6, C#
  - **WebSocket**: `System.Net.WebSockets` để giao tiếp real-time.
  - **JSON**: `System.Text.Json` để tuần tự hóa dữ liệu.
- **Client**: HTML5, CSS3, JavaScript (ES6 Modules)
  - **Bootstrap 5**: Framework cho layout và component cơ bản.
  - **Font Awesome 6**: Icon.
  - **Chart.js**: Vẽ biểu đồ hiệu suất.
- **Giao thức**: WebSocket (ws://).

---

## 🏃 Hướng Dẫn Chạy

1.  **Chạy Server**:
    - Mở project `RemoteControlServer.sln` bằng Visual Studio.
    - Build và chạy project (F5). Server sẽ khởi động và lắng nghe ở `ws://localhost:8181`.
2.  **Chạy Client**:
    - Mở file `Client/index.html` bằng trình duyệt web (khuyến khích dùng Live Server của VS Code).
    - Nhập IP, Port của server và mật khẩu (nếu có) để kết nối.

---

## 👥 Thành Viên Nhóm

*(Vui lòng cập nhật danh sách thành viên tại đây)*
- Nguyễn Văn A - Nhóm trưởng
- Trần Thị B - Backend Developer
- ...