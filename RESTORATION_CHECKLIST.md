# 📋 TestNewWeb Restoration Checklist

**Ngày bắt đầu:** ___________  
**Người thực hiện:** ___________  
**Trạng thái:** 🔴 Chưa bắt đầu | 🟡 Đang fix | 🟢 Hoàn thành

---

## 🚀 PHASE 1: Setup & Preparation

### A. Backup & Safety
- [ ] Backup toàn bộ TestNewWeb/Client folder
- [ ] Verify computer_networking_proj còn nguyên vẹn (reference code)
- [ ] Git commit current state (nếu dùng Git)
- [ ] Đọc RESTORATION_PLAN.md và QUICK_START_FIX.md

### B. File Preparation
- [ ] Tạo/verify `Client/css/fixes.css` exists
- [ ] Tạo/verify `Client/js/navigation-simple.js` exists
- [ ] Run `apply-quick-fixes.ps1` script
- [ ] Verify fixes.css được linked trong index.html

**Phase 1 Status:** [ ] Complete

---

## 🔧 PHASE 2: Core Fixes

### A. Navigation System
- [ ] Import `setupSimpleNavigation` trong main.js
- [ ] Replace `setupNavigation()` với `setupSimpleNavigation()`
- [ ] Test: Click sidebar items → tabs should change
- [ ] Test: Active state highlights correctly
- [ ] Test: Page title updates
- [ ] Verify trong console: "Found X navigation buttons"

**Issues found:**
```
[Ghi chú các vấn đề gặp phải ở đây]




```

### B. Disable Animations (Temporary)
- [ ] Comment out `setupScrollAnimations()` call
- [ ] Comment out page entrance animation
- [ ] Verify tabs switch instantly without delays
- [ ] No animation-related errors in console

### C. CSS Fixes
- [ ] Verify `.tab-content.active` has `display: block !important`
- [ ] Check sidebar nav-link active state styling
- [ ] Buttons are clickable (cursor: pointer)
- [ ] No layout breaks visible

**Phase 2 Status:** [ ] Complete

---

## ✅ PHASE 3: Feature Testing

### Dashboard Tab
- [ ] Tab hiển thị khi click
- [ ] System info cards render
- [ ] CPU/RAM stats hiển thị (nếu có)
- [ ] Installed apps list loads
- [ ] Quick launch app input hoạt động
- [ ] Shutdown/Restart buttons hoạt động
- [ ] Web shortcuts (YouTube, Google, etc.) hoạt động

**Issues:**
```




```

### Screen Monitor Tab
- [ ] Tab hiển thị
- [ ] Canvas element exists và visible
- [ ] Start Monitor button hoạt động
- [ ] Screenshot stream hiển thị
- [ ] Stop Monitor button hoạt động
- [ ] Screenshot button hoạt động
- [ ] Mouse control hoạt động (nếu có)
- [ ] Keyboard input hoạt động (nếu có)

**Issues:**
```




```

### Webcam Tab
- [ ] Tab hiển thị
- [ ] Webcam list loads from server
- [ ] Select webcam dropdown hoạt động
- [ ] Start Webcam button hoạt động
- [ ] Video stream hiển thị
- [ ] Stop Webcam button hoạt động
- [ ] No "stream not found" errors

**Issues:**
```




```

### Process Manager Tab
- [ ] Tab hiển thị
- [ ] Running processes list loads
- [ ] Process table hiển thị đúng columns (PID, Name, CPU, Memory)
- [ ] Kill process button hoạt động
- [ ] Refresh button hoạt động
- [ ] Installed apps section loads
- [ ] Start app from list hoạt động

**Issues:**
```




```

### File Manager Tab
- [ ] Tab hiển thị
- [ ] Drive list loads (C:, D:, etc.)
- [ ] Click drive → file tree loads
- [ ] Navigate folders hoạt động
- [ ] File operations toolbar visible
- [ ] Copy file/folder hoạt động
- [ ] Delete file/folder hoạt động
- [ ] Rename hoạt động
- [ ] Download file hoạt động
- [ ] Context menu hoạt động (if any)

**Issues:**
```




```

### Terminal/Keylogger Tab
- [ ] Tab hiển thị
- [ ] Terminal output area visible
- [ ] Logs hiển thị từ server
- [ ] Auto-scroll hoạt động
- [ ] Clear logs button hoạt động (nếu có)
- [ ] Keylogger logs hiển thị (nếu có)

**Issues:**
```




```

**Phase 3 Status:** [ ] Complete

---

## 🎨 PHASE 4: UI/UX Fixes

### General UI
- [ ] Login screen hiển thị đúng
- [ ] Login form hoạt động
- [ ] Connection success → chuyển sang app
- [ ] Disconnect button hoạt động
- [ ] Logo click → return to dashboard
- [ ] Theme toggle hoạt động (nếu có)
- [ ] Menu toggle hoạt động (sidebar collapse - nếu có)

### Visual Elements
- [ ] Buttons có hover effects
- [ ] Cards có proper shadows/borders
- [ ] Icons hiển thị đúng
- [ ] Colors theo design system
- [ ] Typography readable
- [ ] No text overflow issues

### Responsive (Bonus)
- [ ] Layout OK trên 1920x1080
- [ ] Layout OK trên 1366x768
- [ ] Layout OK trên laptop 1280x720
- [ ] Sidebar responsive (nếu có)

**Phase 4 Status:** [ ] Complete

---

## 🐛 PHASE 5: Bug Fixes & Polish

### Console Errors
- [ ] No JavaScript errors khi load page
- [ ] No errors khi switching tabs
- [ ] No errors khi using features
- [ ] No CSS warnings

**Errors found:**
```




```

### Performance
- [ ] Page load < 2 seconds
- [ ] Tab switching < 300ms
- [ ] No memory leaks (test sau 30 phút usage)
- [ ] Smooth interactions, no lag

### Edge Cases
- [ ] Rapid tab switching không crash
- [ ] Disconnect → Reconnect hoạt động
- [ ] Server disconnect → UI shows error properly
- [ ] Empty states hiển thị (no apps, no files, etc.)

**Phase 5 Status:** [ ] Complete

---

## 🎯 PHASE 6: Optional Enhancements

### Restore Animations (Nếu muốn)
- [ ] Plan: Quyết định animations nào cần
- [ ] Implement CSS-based animations cho tabs
- [ ] Add subtle hover animations
- [ ] Add loading spinners
- [ ] Test performance impact
- [ ] Adjust timings cho smooth feel

### Code Cleanup
- [ ] Remove commented code
- [ ] Remove unused CSS
- [ ] Remove console.logs (hoặc wrap trong debug flag)
- [ ] Update comments
- [ ] Format code consistently

### Documentation
- [ ] Update README.md với UI changes
- [ ] Document any breaking changes
- [ ] Add screenshots to docs
- [ ] Update FEATURES documentation

**Phase 6 Status:** [ ] Complete

---

## 📊 Overall Progress

**Phases Completed:** ___/6

**Estimated Time:**
- Phase 1: 15 mins
- Phase 2: 30 mins
- Phase 3: 1-2 hours
- Phase 4: 30 mins
- Phase 5: 30 mins
- Phase 6: 1 hour (optional)

**Total Time Spent:** _______

---

## 🎉 Final Verification

### Smoke Test
Chạy qua full workflow:
1. [ ] Open app → Login screen shows
2. [ ] Enter credentials → Connect
3. [ ] Dashboard loads với data
4. [ ] Click mỗi tab một lần → all load
5. [ ] Test 1 feature ở mỗi tab
6. [ ] Disconnect → Return to login
7. [ ] Reconnect → Everything works

### Sign-off
- [ ] All critical features work
- [ ] No blocking bugs
- [ ] UI looks acceptable
- [ ] Performance acceptable
- [ ] Ready for use/demo

**Completion Date:** ___________  
**Notes:**
```




```

---

## 📝 Notes & Observations

### Vấn đề không fix được:
```




```

### Improvements for future:
```




```

### Lessons learned:
```




```

---

## 🔄 Rollback Plan

Nếu cần rollback về bản gốc:

```powershell
# Restore from backup
Copy-Item -Path "[BACKUP_PATH]\Client\*" -Destination "TestNewWeb\Client\" -Recurse -Force

# Or restore from computer_networking_proj
Copy-Item -Path "computer_networking_proj\Client\*" -Destination "TestNewWeb\Client\" -Recurse -Force
```

Backup paths:
- Manual backup: _______________________
- Auto backup từ script: Client_BACKUP_[timestamp]
- Git commit: _______________________

---

**END OF CHECKLIST**

✅ Hoàn thành = Tất cả features hoạt động, no critical bugs  
🎨 Polish = Features work + UI refined + Animations smooth  
🚀 Production Ready = Polish + Documented + Tested
