# Kế Hoạch Chỉnh Bố Cục System Information & Performance

## 📋 Phân Tích Hiện Tại

### System Information (Hiện tại)
- **Layout**: 2 cột grid (2x3 = 6 cards)
- **Structure**: Card chứa icon + content (label + value nằm ngang)
- **File**: `index.html` (lines 350-427), `system-stats.css` (lines 357-425)

### Performance (Hiện tại)
- **Layout**: 2x2 grid (4 cells: CPU, GPU, RAM, DISK)
- **Design**: 4 cells bằng nhau trong container
- **File**: `index.html` (lines 430-495), `system-stats.css` (lines 425-542)

---

## 🎯 Bố Cục Mục Tiêu

### System Information (Theo Pasted Image)
**Layout**: 2 cột × 3 hàng (giữ nguyên)
```
┌────────────────────────────────────┬────────────────────────────────────┐
│  HỆ ĐIỀU HÀNH                     │  TÊN MÁY (HOSTNAME)                │
│  Microsoft Windows NT 10.0.26100.0 │  HOAINGNHAT1307                    │
├────────────────────────────────────┼────────────────────────────────────┤
│  CPU MODEL                         │  CARD ĐỒ HỌA (GPU)                │
│  12th Gen Intel(R) Core(TM)        │  Intel(R) Iris(R) Xe Graphics     │
│  i7-12700H                         │                                    │
├────────────────────────────────────┼────────────────────────────────────┤
│  Ổ CỨNG CHÍNH                     │  VRAM                              │
│  225 GB                            │  1 GB                              │
└────────────────────────────────────┴────────────────────────────────────┘
```

**Đặc điểm**:
- Grid: 2 cột × 3 hàng (GIỮ NGUYÊN hiện tại)
- Card layout: Horizontal (icon + text nằm ngang)
- Label trên, value dưới nhưng text căn trái
- Icon + content nằm ngang
- Giữ nguyên màu sắc từ web cũ

---

### Performance (Theo Pasted Image)
**Layout**: 1 hàng, 4 phần tử - GPU/RAM/CPU/SSD

```
┌─────────────┬──────────────────────┬─────────────┬──────────────┐
│   GPU Bar   │   CPU GAUGE (Large)  │   RAM Bar   │  SSD GAUGE   │
│    5%       │       5% (center)    │    80%      │    49%       │
│   [5%]      │    [Blue Gauge]      │   [80%]     │  [Blue Gauge]│
└─────────────┴──────────────────────┴─────────────┴──────────────┘
```

**Đặc điểm**:
- 1 hàng, 4 cell có width không bằng nhau
- GPU bar (nhỏ) | CPU gauge (LỚN - center focus) | RAM bar (nhỏ) | SSD gauge (nhỏ)
- CPU chiếm không gian lớn hơn (~35-40%), các cái khác ~20% mỗi cái
- Horizontal layout với flex distribution
- Darker theme hiển thị

---

## 🔧 Danh Sách Thay Đổi Chi Tiết

### 1️⃣ HTML Structure Changes (`index.html`)

**System Information Section (Lines 350-427)**
- **GIỮ NGUYÊN** grid 2 cột × 3 hàng
- Card layout: Vẫn horizontal (icon + content nằm ngang)
- Không cần thay đổi HTML structure

**Performance Section (Lines 430-495)**
- Thay đổi structure sang layout 1 hàng × 4 phần tử
- Sắp xếp: GPU bar | CPU gauge (LỚN) | RAM bar | SSD gauge
- Grid hoặc flex layout với flex-grow khác nhau
  - GPU, RAM, SSD: flex: 1 (bằng nhau)
  - CPU: flex: 1.5-2 (lớn hơn)
- Có thể giữ nguyên HTML order hoặc sắp xếp lại

### 2️⃣ CSS Changes (`system-stats.css`)

#### System Information (Lines 357-425) - GIỮ NGUYÊN
```css
.system-info-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);  /* Giữ nguyên 2 cột */
  gap: 12px;
  /* Không cần thay đổi */
}

/* Giữ lại layout hiện tại hoàn toàn */
```

**✅ Không thay đổi System Information section**

#### Performance Grid Updates (Lines 425-542)
**Approach: Flex Layout hoặc CSS Grid với unequal widths**

```css
.performance-grid {
  display: flex;
  flex-direction: row;      /* 1 hàng */
  gap: 12px;
  height: auto;
  min-height: 220px;
  background: var(--stat-card);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  position: relative;
}

.perf-cell {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(59, 130, 246, 0.08) 100%);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  position: relative;
  
  /* Default flex distribution */
  flex: 1;
  min-width: 0;
}

/* CPU cell - LỚN HƠN */
.perf-cell:nth-child(1) {  /* CPU LOAD */
  flex: 1.5;  /* 1.5x width của các cell khác */
}

/* GPU - normal */
.perf-cell:nth-child(2) {
  flex: 1;
}

/* RAM - normal */
.perf-cell:nth-child(3) {
  flex: 1;
}

/* SSD - normal */
.perf-cell:nth-child(4) {
  flex: 1;
}

/* Gauge sizing cho CPU */
.perf-cell:nth-child(1) .gauge--md {
  max-width: 140px;  /* Lớn hơn 110px */
  aspect-ratio: 1;
}

.perf-cell:nth-child(1) .gauge__value {
  font-size: 1.8rem;  /* Lớn hơn 1.65rem */
}

/* Bar sizing cho GPU/RAM - giữ như cũ hoặc tối ưu */
.perf-cell:nth-child(2) .bar-vertical--lg,
.perf-cell:nth-child(3) .bar-vertical--lg {
  width: 42px;
  height: 90px;
}
```

**Alternative: CSS Grid with unequal columns**
```css
.performance-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 1fr;  /* CPU 1.5x */
  gap: 12px;
  grid-auto-rows: 1fr;
}

.perf-cell {
  /* Grid will automatically position them */
}
```

### 3️⃣ Giữ Nguyên Các Yếu Tố

✅ **Giữ nguyên:**
- Màu sắc hiện tại (variables.css)
- Animation & transitions
- Dark theme support
- Icons
- Status badges (state-ok, state-warn, state-danger)
- Real-time indicator (nếu cần)
- Responsive behavior (mobile adjustments)
- Gap/spacing ratios

---

## 📊 Chi Tiết CSS Classes Ảnh Hưởng

### Classes cần sửa:
1. `.system-info-cards` - Grid layout
2. `.info-card` - Card structure
3. `.info-card__icon` - Icon positioning
4. `.info-card__content` - Content ordering
5. `.performance-grid` - Main grid layout
6. `.perf-cell` - Cell sizing
7. `.perf-cell--gauge` - Gauge sizing
8. `.perf-cell--bar` - Bar sizing
9. Media queries (responsive)

### Classes cần thêm:
- `.perf-cell--cpu-center` (optional, cho CSS specificity)
- Hoặc dùng `:nth-child()` selectors

---

## ⚡ Thứ Tự Thực Hiện

1. **Bước 1**: Sửa Performance grid layout (2x2 → 1 hàng 4 cột)
2. **Bước 2**: Điều chỉnh flex distribution (CPU 1.5x, GPU/RAM/SSD 1x)
3. **Bước 3**: Tối ưu gauge sizing cho CPU (lớn hơn)
4. **Bước 4**: Test responsive (992px breakpoint)
5. **Bước 5**: Fine-tune spacing
6. **Bước 6**: Test cả light & dark themes

---

## 🎨 Màu Sắc Duy Trì

Từ `system-stats.css` `:root`:
- **Primary**: `#3b82f6` (Blue)
- **Success**: `#10b981` (Green)
- **Warning**: `#f59e0b` (Amber)
- **Danger**: `#ef4444` (Red)
- Text: `#1e293b` (Light mode), `#f8fafc` (Dark mode)

**Không thay đổi** - giữ nguyên variables từ web cũ

---

## 📝 Tóm Tắt Các File Cần Sửa

| File | Lines | Thay Đổi |
|------|-------|---------|
| `system-stats.css` | 425-542 | `.performance-grid` & `.perf-cell*` từ grid 2x2 → flex 1 hàng |
| `index.html` | (không cần) | Giữ nguyên HTML structure |

**System Information**: ✅ KHÔNG THAY ĐỔI (giữ nguyên 2 cột 3 hàng)

---

## ✨ Expected Results

### Before → After

**System Information:**
- ✅ 2 cột × 3 hàng → 2 cột × 3 hàng (GIỮ NGUYÊN)
- ✅ Card layout giữ nguyên (horizontal)

**Performance:**
- ❌ 2×2 grid (4 cells bằng nhau) → ✅ 1 hàng, 4 cells khác nhau
- ❌ CPU nhỏ bằng cái khác → ✅ CPU 1.5x size (focus chính)
- ❌ Arrangement cũ → ✅ GPU bar | CPU gauge | RAM bar | SSD gauge
- ✅ Colors & styling giữ nguyên

---

## 🔍 Validation Checklist

- [ ] System Information vẫn là 2 cột × 3 hàng
- [ ] Performance là 1 hàng, 4 phần tử
- [ ] CPU gauge chiếm 1.5x width
- [ ] GPU bar | CPU gauge | RAM bar | SSD gauge layout
- [ ] Colors consistent with old web
- [ ] Responsive at 992px breakpoint
- [ ] Dark theme applied correctly
- [ ] Gauges animate smoothly
- [ ] Spacing balanced
- [ ] No visual glitches

