# KẾ HOẠCH CHUYỂN ĐỔI LAYOUT PERFORMANCE

## 📋 MÔ TẢ YÊU CẦU

Chuyển đổi bố cục phần **Performance** từ layout 1 hàng 4 cột hiện tại sang layout 2 khối theo hình mẫu:
- **Khối trái**: Chứa 3 phần (GPU, CPU, RAM) trong một grid
- **Khối phải**: Chứa SSD độc lập

### Layout Hiện Tại
```
┌─────────────────────────────────────────────────┐
│  CPU    │   GPU    │   RAM    │   SSD           │
│ (gauge) │  (bar)   │  (bar)   │ (gauge)         │
└─────────────────────────────────────────────────┘
```

### Layout Mới (Theo Hình Mẫu)
```
┌─────────────────────────┐  ┌────────────┐
│  GPU        │           │  │            │
│  (bar)      │    CPU    │  │    SSD     │
│             │  (gauge)  │  │  (gauge)   │
├─────────────┤   LARGE   │  │            │
│             │           │  │            │
│    RAM      │           │  │            │
│    (bar)    │           │  │            │
└─────────────────────────┘  └────────────┘
```

## 🎯 CÁC BƯỚC THỰC HIỆN

### 1. CẤU TRÚC HTML MỚI

#### HTML Structure
```html
<div class="performance-grid">
  <!-- LEFT BLOCK: 3-part grid -->
  <div class="perf-grid-left">
    <!-- GPU - Top Left (Small vertical bar) -->
    <div class="perf-cell perf-cell--bar" id="perf-gpu">
      <div class="perf-cell__title">GPU</div>
      <div class="bar-vertical bar-vertical--lg">
        <div class="bar-vertical__fill" id="stat-gpu-bar"></div>
      </div>
      <div class="perf-cell__value" id="stat-gpu-percent">0%</div>
      <span class="stat-badge state-ok" id="stat-gpu-badge">Idle</span>
      <div class="perf-cell__info" id="stat-gpu-info">--</div>
    </div>

    <!-- CPU - Center (Large circular gauge, spans 2 rows) -->
    <div class="perf-cell perf-cell--gauge perf-cell--cpu" id="perf-cpu">
      <div class="perf-cell__title">CPU</div>
      <div class="gauge gauge--xl">
        <svg class="gauge__svg" viewBox="0 0 140 140">
          <circle class="gauge__track" cx="70" cy="70" r="55" fill="none"></circle>
          <circle class="gauge__progress" id="stat-cpu-gauge" cx="70" cy="70" r="55" fill="none"></circle>
        </svg>
        <div class="gauge__center">
          <span class="gauge__value" id="stat-cpu-percent">0%</span>
          <span class="gauge__sub" id="stat-cpu-freq">--</span>
        </div>
      </div>
      <span class="stat-badge state-ok" id="stat-cpu-badge">Normal</span>
    </div>

    <!-- RAM - Bottom Right (Small vertical bar) -->
    <div class="perf-cell perf-cell--bar" id="perf-vram">
      <div class="perf-cell__title">RAM</div>
      <div class="bar-vertical bar-vertical--lg">
        <div class="bar-vertical__fill" id="stat-ram-bar"></div>
      </div>
      <div class="perf-cell__value" id="stat-ram-percent">0%</div>
      <span class="stat-badge state-ok" id="stat-ram-badge">OK</span>
      <div class="perf-cell__info" id="stat-ram-abs">--</div>
    </div>
  </div>

  <!-- RIGHT BLOCK: SSD standalone -->
  <div class="perf-grid-right">
    <div class="perf-cell perf-cell--gauge perf-cell--ssd" id="perf-ssd">
      <div class="perf-cell__title">
        <i class="fas fa-hdd"></i> SSD
      </div>
      <div class="gauge gauge--lg">
        <svg class="gauge__svg" viewBox="0 0 140 140">
          <circle class="gauge__track" cx="70" cy="70" r="55" fill="none"></circle>
          <circle class="gauge__progress" id="stat-ssd-gauge" cx="70" cy="70" r="55" fill="none"></circle>
        </svg>
        <div class="gauge__center">
          <span class="gauge__value" id="stat-ssd-percent">0%</span>
        </div>
      </div>
      <span class="stat-badge state-ok" id="stat-ssd-badge">Healthy</span>
      <div class="gauge__sub-info">
        <div id="stat-ssd-abs">245GB/476GB</div>
        <div class="text-muted small">SKHynix_HFS...</div>
      </div>
    </div>
  </div>

  <!-- Realtime indicator -->
  <div class="realtime-indicator">
    <i class="fas fa-sync-alt"></i> Cập nhật thời gian thực...
  </div>
</div>
```

### 2. CSS LAYOUT MỚI

#### system-stats.css - Performance Grid Updates

```css
/* Main Performance Grid - 2 column layout */
.performance-grid {
  display: grid;
  grid-template-columns: 2fr 1fr; /* Left block wider, right block narrower */
  gap: 14px;
  height: 100%;
  min-height: 300px;
  background: transparent;
  padding: 0;
  position: relative;
}

/* LEFT BLOCK - 3-part grid */
.perf-grid-left {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 2 columns */
  grid-template-rows: 1fr 1fr; /* 2 rows */
  gap: 10px;
  background: var(--stat-card);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* RIGHT BLOCK - SSD standalone */
.perf-grid-right {
  display: flex;
  background: var(--stat-card);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Base cell styling */
.perf-cell {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(59, 130, 246, 0.08) 100%);
  border-radius: 10px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  position: relative;
}

[data-theme="dark"] .perf-cell {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.12) 100%);
  border-color: rgba(255, 255, 255, 0.06);
}

.perf-cell:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

/* GPU - Top Left (row 1, col 1) */
#perf-gpu {
  grid-column: 1;
  grid-row: 1;
}

/* CPU - Center Large (row 1-2, col 2 - spans 2 rows) */
.perf-cell--cpu {
  grid-column: 2;
  grid-row: 1 / 3; /* Span both rows */
  padding: 20px 14px;
}

/* RAM - Bottom Right (row 2, col 1) */
#perf-vram {
  grid-column: 1;
  grid-row: 2;
}

/* SSD - Full height in right block */
.perf-cell--ssd {
  flex: 1;
  min-height: 100%;
  padding: 20px 16px;
}

/* Gauge sizes */
.gauge--xl {
  max-width: 165px;
  width: 100%;
  aspect-ratio: 1;
  margin: 8px auto;
}

.gauge--lg {
  max-width: 125px;
  width: 100%;
  aspect-ratio: 1;
  margin: 8px auto;
}

/* CPU gauge value - larger text */
.perf-cell--cpu .gauge__value {
  font-size: 2.8rem;
  font-weight: 800;
  line-height: 1;
}

.perf-cell--cpu .gauge__sub {
  font-size: 0.85rem;
  margin-top: 4px;
  color: var(--stat-text-muted);
}

/* SSD gauge value */
.perf-cell--ssd .gauge__value {
  font-size: 2rem;
  font-weight: 800;
}

/* Bar vertical for GPU and RAM */
.bar-vertical--lg {
  width: 42px;
  height: 100px;
  border-radius: 10px;
  background: var(--stat-track);
  position: relative;
  overflow: hidden;
}

.bar-vertical__fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, var(--stat-accent), var(--stat-accent-2));
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 10px;
}

/* Realtime indicator */
.realtime-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: var(--stat-text-muted);
  font-style: italic;
  white-space: nowrap;
  pointer-events: none;
}

.realtime-indicator i {
  animation: rotate 2s linear infinite;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .performance-grid {
    grid-template-columns: 1.5fr 1fr;
    min-height: 280px;
  }
  
  .gauge--xl {
    max-width: 145px;
  }
  
  .gauge--lg {
    max-width: 110px;
  }
}

@media (max-width: 992px) {
  .performance-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    min-height: auto;
  }
  
  .perf-grid-left,
  .perf-grid-right {
    width: 100%;
  }
  
  .perf-cell--cpu {
    grid-row: 1 / 2; /* Don't span on smaller screens */
  }
  
  .gauge--xl {
    max-width: 130px;
  }
}

@media (max-width: 768px) {
  .perf-grid-left {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 10px;
  }
  
  .perf-cell--cpu {
    grid-column: 1;
    grid-row: auto;
  }
  
  #perf-gpu,
  #perf-vram,
  .perf-cell--ssd {
    min-height: 180px;
  }
  
  .bar-vertical--lg {
    height: 94px;
  }
}

@media (max-width: 576px) {
  .perf-grid-left,
  .perf-grid-right {
    padding: 16px;
  }
  
  .gauge--xl {
    max-width: 115px;
  }
  
  .gauge--lg {
    max-width: 95px;
  }
  
  .perf-cell--cpu .gauge__value {
    font-size: 2.2rem;
  }
  
  .perf-cell--ssd .gauge__value {
    font-size: 1.6rem;
  }
}
```

## 🎨 ĐẶC ĐIỂM THIẾT KẾ

### Màu Sắc (Giữ Nguyên)
- Gradient background cho cells
- Progress colors theo trạng thái (blue/green/yellow/red)
- Shadow effects khi hover
- Dark mode compatibility

### Kích Thước
- **CPU Gauge**: Lớn nhất (180px), vị trí trung tâm, span 2 rows
- **SSD Gauge**: Trung bình (140px), chiếm full khối phải
- **GPU/RAM Bars**: Thanh dọc 48px x 110px

### Hiệu Ứng (Giữ Nguyên)
- Smooth transitions (0.3s)
- Hover scale effect (1.02)
- Rotating sync icon
- Gradient fills
- Shadow depth

## 📱 RESPONSIVE BREAKPOINTS

| Breakpoint | Layout | Notes |
|------------|--------|-------|
| > 1200px | 2 columns (2fr + 1fr) | Layout mẫu chuẩn |
| 992px - 1200px | 2 columns (1.5fr + 1fr) | Thu nhỏ một chút |
| 768px - 992px | Stack vertical | Left block trước, Right block sau |
| < 768px | Single column | Tất cả cells stack theo chiều dọc |

## ✅ CHECKLIST IMPLEMENTATION

- [ ] **Bước 1**: Backup file hiện tại
  - `index.html` → `index.html.backup-performance-layout`
  - `system-stats.css` → `system-stats.css.backup-performance-layout`

- [ ] **Bước 2**: Cập nhật HTML structure
  - Thêm wrapper `.perf-grid-left` và `.perf-grid-right`
  - Sắp xếp lại thứ tự: GPU → CPU → RAM → SSD
  - Thêm ID cho từng cell để dễ styling
  - Giữ nguyên tất cả ID của các elements bên trong (để JS hoạt động)

- [ ] **Bước 3**: Cập nhật CSS
  - Thay đổi `.performance-grid` sang grid 2 columns
  - Tạo styling cho `.perf-grid-left` (2x2 grid)
  - Tạo styling cho `.perf-grid-right` (flexbox)
  - Định nghĩa grid positions cho GPU, CPU, RAM
  - Cập nhật gauge sizes (xl cho CPU, lg cho SSD)
  - Thêm/cập nhật media queries

- [ ] **Bước 4**: Test functionality
  - Kiểm tra CPU gauge animation
  - Kiểm tra GPU bar fill
  - Kiểm tra RAM bar fill
  - Kiểm tra SSD gauge animation
  - Verify tất cả stats updates từ WebSocket

- [ ] **Bước 5**: Test responsive
  - Desktop (1920x1080, 1440x900)
  - Tablet (768x1024, 1024x768)
  - Mobile (375x667, 414x896)

- [ ] **Bước 6**: Fine-tuning
  - Điều chỉnh spacing/padding nếu cần
  - Kiểm tra colors ở dark mode
  - Verify hover effects
  - Tối ưu animation performance

## 🔧 COMPATIBILITY NOTES

### JS Files Không Cần Thay Đổi
Tất cả ID của elements (như `stat-cpu-percent`, `stat-gpu-bar`, etc.) giữ nguyên nên các file JS sau vẫn hoạt động bình thường:
- `main.js` - Update stats logic
- `dashboard.js` - System info display
- `socket.js` - WebSocket data handlers

### Backward Compatibility
- Giữ nguyên class `.perf-cell--gauge` và `.perf-cell--bar`
- Giữ nguyên structure của gauge và bar internals
- Chỉ thay đổi outer layout wrapper

## 🚀 IMPLEMENTATION TIMELINE

1. **Phase 1** (15 phút): HTML restructuring
2. **Phase 2** (20 phút): CSS grid implementation
3. **Phase 3** (15 phút): Responsive adjustments
4. **Phase 4** (10 phút): Testing & validation
5. **Total**: ~60 phút

## 📸 KẾT QUẢ MONG ĐỢI

Layout cuối cùng sẽ trông giống hình mẫu:
- Khối trái có 3 phần với CPU ở giữa chiếm 2 hàng
- Khối phải có SSD độc lập
- Màu sắc và hiệu ứng giữ nguyên như hiện tại
- Responsive tốt trên mọi thiết bị
- JavaScript functionality không bị ảnh hưởng
