# Kế Hoạch Thay Đổi Logo và Branding sang N-SIGHT

## 📋 Tổng Quan
Dự án hiện tại sử dụng tên gọi "RCS System" (Remote Control System). Kế hoạch này sẽ hướng dẫn thay đổi toàn bộ branding thành **N-SIGHT** với logo mới.

---

## 🎯 Các Điểm Thay Đổi Cần Thực Hiện

### 1. **Logo Hình Ảnh** 
- **Vị trí lưu trữ**: `Client/assets/team/`
- **Tệp cần tạo**: 
  - `nsight-logo.png` (Logo chính - PNG 256x256)
  - `nsight-logo-white.png` (Phiên bản trắng cho nền tối)
  - `nsight-icon.svg` (Icon SVG cho favicon)
- **Công việc**:
  - [ ] Lưu hình N-SIGHT logo vào `Client/assets/team/nsight-logo.png`
  - [ ] Tạo phiên bản trắng nếu cần thiết

### 2. **Favicon - Biểu Tượng Trên Tab Trình Duyệt**
**Tệp**: `Client/index.html` (dòng 8-10)
- **Thay đổi hiện tại**: 
  ```html
  <link
    rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🖥️</text></svg>"
  />
  ```
- **Thay đổi thành**: 
  ```html
  <link rel="icon" href="assets/team/nsight-icon.png" type="image/png" />
  ```
- **Công việc**:
  - [ ] Cập nhật favicon link

### 3. **Logo Trên Sidebar/Navigation** 
**Tệp**: `Client/index.html` (dòng 101-108)
- **Thay đổi hiện tại**:
  ```html
  <a class="navbar-brand m-0 d-flex align-items-center" 
     style="cursor: pointer" 
     id="logo-heading" 
     title="Back to Dashboard">
    <i class="fas fa-network-wired text-primary" style="font-size: 1.5rem"></i>
    <span class="ms-2 font-weight-bold text-primary">RCS SYSTEM</span>
  </a>
  ```
- **Thay đổi thành**: 
  ```html
  <a class="navbar-brand m-0 d-flex align-items-center" 
     style="cursor: pointer" 
     id="logo-heading" 
     title="Back to Dashboard">
    <img src="assets/team/nsight-logo.png" alt="N-SIGHT" style="height: 40px; width: auto;">
    <span class="ms-2 font-weight-bold text-primary">N-SIGHT</span>
  </a>
  ```
- **Công việc**:
  - [ ] Thay đổi icon từ Font Awesome thành hình ảnh logo
  - [ ] Cập nhật text từ "RCS SYSTEM" thành "N-SIGHT"

### 4. **Login Form Heading**
**Tệp**: `Client/index.html` (dòng 43)
- **Thay đổi hiện tại**:
  ```html
  <h2 class="mb-4 fw-bold text-primary">
    <i class="fas fa-shield-alt"></i> RCS Login
  </h2>
  ```
- **Thay đổi thành**:
  ```html
  <h2 class="mb-4 fw-bold text-primary">
    <i class="fas fa-eye"></i> N-SIGHT Login
  </h2>
  ```
- **Công việc**:
  - [ ] Thay đổi text heading

### 5. **Landing Page Logo**
**Tệp**: `Client/landing/landing.html` (dòng 34)
- **Thay đổi hiện tại**:
  ```html
  <span class="fw-bold text-primary">RCS SYSTEM</span>
  ```
- **Thay đổi thành**:
  ```html
  <span class="fw-bold text-primary">N-SIGHT</span>
  ```
- **Công việc**:
  - [ ] Cập nhật text trên landing page

### 6. **Tiêu Đề Trang Web (Page Title)**
**Các Tệp Cần Thay Đổi**:

#### a. `Client/index.html` (dòng 6)
- **Thay đổi từ**: `<title>RCS - Remote Control System</title>`
- **Thay đổi thành**: `<title>N-SIGHT - Network Intelligence & Surveillance Hub</title>`

#### b. `Client/landing/landing.html` (dòng 6)
- **Thay đổi từ**: `<title>RCS — Landing</title>`
- **Thay đổi thành**: `<title>N-SIGHT — Landing</title>`

#### c. `Client/home.html` (dòng 6)
- **Thay đổi từ**: `<title>RCS — Entry</title>`
- **Thay đổi thành**: `<title>N-SIGHT — Entry</title>`

- **Công việc**:
  - [ ] Cập nhật tất cả page titles

### 7. **Badge và Branding Nhỏ**
**Tệp**: `Client/home.html` (dòng 55)
- **Thay đổi từ**: `<span class="badge-soft">RCS</span>`
- **Thay đổi thành**: `<span class="badge-soft">N-SIGHT</span>`
- **Công việc**:
  - [ ] Cập nhật badge text

### 8. **Footer Copyright**
**Tệp**: `Client/landing/landing.html` (dòng 239)
- **Thay đổi từ**: `<small>© <span id="year"></span> RCS Team — All rights reserved.</small>`
- **Thay đổi thành**: `<small>© <span id="year"></span> N-SIGHT Team — All rights reserved.</small>`
- **Công việc**:
  - [ ] Cập nhật footer text

### 9. **Thông Tin Team trong JSON**
**Tệp**: `Client/js/data/team.json`
- **Tùy chọn**: Thêm team logo/description
- **Thay đổi**:
  ```json
  [
    {
      "name": "Nguyễn Văn A",
      "role": "Nhóm trưởng",
      "avatar": "../../assets/team/a.jpg",
      "github": "https://github.com/example",
      "facebook": "https://facebook.com/example",
      "email": "example@gmail.com"
    },
    ...
  ]
  ```
- **Công việc**:
  - [ ] Xem xét cập nhật thông tin team (tùy chọn)

### 10. **README.md Chính**
**Tệp**: `ComputerNetworkingProj/README.md`
- **Thay đổi**:
  - Cập nhật tên dự án từ "RCS" thành "N-SIGHT"
  - Thêm mô tả về tên N-SIGHT
  - Cập nhật hình ảnh logo nếu có
- **Công việc**:
  - [ ] Cập nhật README

---

## 📊 Danh Sách Chi Tiết Tệp Cần Thay Đổi

| # | Tệp | Thay Đổi | Ưu Tiên |
|---|-----|---------|--------|
| 1 | `Client/index.html` | Favicon, Logo sidebar, Login heading, Title | 🔴 Cao |
| 2 | `Client/landing/landing.html` | Logo text, Title, Footer | 🔴 Cao |
| 3 | `Client/home.html` | Badge, Title | 🟡 Trung |
| 4 | `ComputerNetworkingProj/README.md` | Tên dự án, mô tả | 🟡 Trung |
| 5 | `Client/assets/team/` | Thêm logo mới | 🔴 Cao |

---

## 🔧 Quy Trình Thực Hiện

### Phase 1: Chuẩn Bị Asset (1-2 ngày)
- [ ] Lưu/Export hình N-SIGHT logo thành PNG
- [ ] Tạo phiên bản icon/favicon từ logo
- [ ] Tạo phiên bản trắng nếu cần cho nền tối
- [ ] Lưu vào thư mục `Client/assets/team/`

### Phase 2: Cập Nhật HTML (1-2 giờ)
- [ ] Cập nhật favicon link trong `index.html`
- [ ] Thay logo và text trên sidebar/navigation
- [ ] Cập nhật tất cả page titles
- [ ] Cập nhật landing page branding
- [ ] Cập nhật footer và badges

### Phase 3: Cập Nhật Nội Dung (1-2 giờ)
- [ ] Cập nhật README.md
- [ ] Xem xét cập nhật team information (nếu cần)
- [ ] Kiểm tra tất cả text references đến "RCS"

### Phase 4: Test & Validate (1-2 giờ)
- [ ] Test tất cả pages trên trình duyệt
- [ ] Kiểm tra favicon hiển thị chính xác
- [ ] Kiểm tra responsive design với logo mới
- [ ] Kiểm tra tất cả links hoạt động

---

## 💡 Lưu Ý Quan Trọng

1. **Font Awesome Icon**: Icon `fa-eye` phù hợp với logo N-SIGHT (con mắt), nhưng có thể thay đổi nếu muốn
2. **Kích Thước Logo**: Đảm bảo logo mới có tỷ lệ khung hình phù hợp (sq. hoặc hình chữ nhật)
3. **Màu Sắc**: Logo N-SIGHT có màu xanh dương chủ đạo - phù hợp với color scheme hiện tại
4. **CSS**: Có thể cần điều chỉnh CSS cho sidebar khi thay từ icon thành hình ảnh
5. **Responsive**: Kiểm tra logo hiển thị tốt trên mobile (kích thước có thể nhỏ lại)

---

## 📝 Trạng Thái Thực Hiện

- **Dự kiến hoàn thành**: 2-3 ngày
- **Khó độ**: Thấp-Trung bình
- **Ảnh hưởng**: Toàn bộ giao diện người dùng

---

## ✅ Checklist Hoàn Thành

- [ ] Logo assets được tạo/lưu
- [ ] `Client/index.html` được cập nhật
- [ ] `Client/landing/landing.html` được cập nhật
- [ ] `Client/home.html` được cập nhật
- [ ] `README.md` được cập nhật
- [ ] Tất cả tests đã hoàn thành
- [ ] Commit thay đổi lên git
- [ ] Deploy version mới

