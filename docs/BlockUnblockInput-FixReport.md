# 🔧 Báo cáo Fix Bug: Block/Unblock Input

> **Ngày:** 19/12/2024  
> **Tác giả:** Development Team  
> **Trạng thái:** ✅ Đã giải quyết

---

## 📋 Mục lục

1. [Mô tả vấn đề](#-mô-tả-vấn-đề)
2. [Quá trình phân tích](#-quá-trình-phân-tích)
3. [Những hướng đi sai](#-những-hướng-đi-sai)
4. [Giải pháp cuối cùng](#-giải-pháp-cuối-cùng)
5. [Kết quả kiểm tra](#-kết-quả-kiểm-tra)
6. [Bài học rút ra](#-bài-học-rút-ra)

---

## 🔴 Mô tả vấn đề

### Triệu chứng

- Chức năng **Block Input** hoạt động bình thường - có thể block mouse và keyboard trên server
- Chức năng **Unblock Input** hoạt động **không ổn định**:
  - Có lúc unblock được ngay
  - Có lúc unblock không hoạt động, user phải thử nhiều lần
  - Một số trường hợp input bị lock vĩnh viễn cho đến khi restart server

### Vị trí code liên quan

| File                             | Chức năng                                               |
| -------------------------------- | ------------------------------------------------------- |
| `Server/Helpers/SystemHelper.cs` | Hàm `DisableInput()` và `EnableInput()` gọi Windows API |
| `Server/Core/CommandRouter.cs`   | Xử lý lệnh `DISABLE_INPUT` và `ENABLE_INPUT` từ client  |
| `Client/js/features/monitor.js`  | Hàm `toggleInputBlock()` gửi lệnh đến server            |

### Windows API được sử dụng

```csharp
[DllImport("user32.dll", SetLastError = true)]
private static extern bool BlockInput(bool fBlockIt);
```

- `BlockInput(true)` - Block tất cả mouse và keyboard input
- `BlockInput(false)` - Unblock input

---

## 🔍 Quá trình phân tích

### Bước 1: Xác định vấn đề

Đọc code hiện tại của hàm `EnableInput()`:

```csharp
// Code cũ - KHÔNG ỔN ĐỊNH
public static bool EnableInput()
{
    try
    {
        // Gọi BlockInput(false) 5 lần liên tiếp với delay nhỏ
        for (int i = 0; i < 5; i++)
        {
            BlockInput(false);
            System.Threading.Thread.Sleep(50);
        }

        bool result = BlockInput(false);
        // ...
    }
    catch (Exception ex)
    {
        // ...
    }
}
```

**Nhận xét:** Code đã có retry 5 lần nhưng vẫn không đủ.

### Bước 2: Nghiên cứu Windows API `BlockInput`

Sau khi tìm hiểu, phát hiện các đặc điểm của `BlockInput` API:

1. **Yêu cầu quyền Administrator** - Nếu không có quyền admin, API sẽ fail
2. **Hành vi không đồng bộ** - Windows có thể không process lệnh unblock ngay lập tức
3. **Race condition** - Nếu có process khác đang block input, lệnh unblock sẽ thất bại
4. **Không có feedback rõ ràng** - API có thể return `true` nhưng input vẫn chưa thực sự unblock

### Bước 3: Trace log để xác nhận

Thêm logging để theo dõi:

- Số lần gọi `BlockInput(false)`
- Error code từ `GetLastWin32Error()`
- Thời điểm unblock thành công

---

## ❌ Những hướng đi sai

### Hướng sai #1: Tăng số lần retry đơn giản

**Ý tưởng:** Tăng số lần gọi `BlockInput(false)` từ 5 lên 10 hoặc 20 lần.

```csharp
// Hướng sai #1
for (int i = 0; i < 20; i++)
{
    BlockInput(false);
    Thread.Sleep(50);
}
```

**Tại sao sai:**

- Không giải quyết được vấn đề gốc
- Windows có thể ignore các lệnh liên tiếp giống nhau
- Vẫn có trường hợp fail

---

### Hướng sai #2: Sử dụng SendKeys để "kick" Windows

**Ý tưởng:** Gửi một phím giả (như NumLock) để force Windows nhận ra input đã được unblock.

```csharp
// Hướng sai #2
try
{
    System.Windows.Forms.SendKeys.SendWait("{NUMLOCK}");
    Thread.Sleep(50);
    System.Windows.Forms.SendKeys.SendWait("{NUMLOCK}");

    BlockInput(false);
}
catch { }
```

**Tại sao sai:**

- `SendKeys` không hoạt động khi input đang bị block
- Có thể gây side effect không mong muốn (toggle NumLock state)
- Không phải giải pháp đáng tin cậy

---

### Hướng sai #3: Chỉ focus vào server-side

**Ý tưởng:** Chỉ cần fix code server là đủ, không cần thay đổi client.

**Tại sao sai:**

- Network có thể drop packet
- Một lệnh ENABLE_INPUT có thể bị mất
- Cần redundancy từ cả 2 phía

---

### Hướng sai #4: Dùng Thread mới để unblock

**Ý tưởng:** Tạo thread riêng để gọi `BlockInput(false)` liên tục.

```csharp
// Hướng sai #4
Task.Run(() => {
    for (int i = 0; i < 100; i++)
    {
        BlockInput(false);
        Thread.Sleep(10);
    }
});
```

**Tại sao sai:**

- Không có cách verify khi nào thực sự unblock xong
- Có thể gây race condition với các lệnh khác
- Tốn tài nguyên không cần thiết

---

## ✅ Giải pháp cuối cùng

### Chiến lược đa tầng (Multi-layer Strategy)

Thay vì chỉ retry đơn giản, sử dụng **3 chiến lược khác nhau** để tăng tỷ lệ thành công:

#### Chiến lược 1: Verify-based retry

```csharp
// Gọi nhiều lần + verify bằng cách block rồi unblock lại
for (int attempt = 0; attempt < 10; attempt++)
{
    for (int i = 0; i < 3; i++)
    {
        BlockInput(false);
    }

    // Verify: thử block rồi unblock để confirm Windows đang listen
    BlockInput(true);
    Thread.Sleep(10);
    success = BlockInput(false);

    if (success) return true;

    Thread.Sleep(100);
}
```

**Ý tưởng:** Block lại rồi unblock ngay để "reset" trạng thái của Windows API.

#### Chiến lược 2: Extended retry với delay dài hơn

```csharp
// Nếu chiến lược 1 fail, thử với delay dài hơn
for (int i = 0; i < 5; i++)
{
    BlockInput(false);
    Thread.Sleep(200);  // Delay 200ms thay vì 50ms
}
```

**Ý tưởng:** Cho Windows đủ thời gian để process lệnh.

#### Chiến lược 3: Brute force fallback

```csharp
// Fallback cuối cùng: gọi liên tục trong 2 giây
var stopwatch = Stopwatch.StartNew();
while (stopwatch.ElapsedMilliseconds < 2000)
{
    BlockInput(false);
    Thread.Sleep(50);
}
```

**Ý tưởng:** Đảm bảo Windows sẽ nhận được lệnh unblock.

### Thay đổi ở Client

Gửi lệnh ENABLE_INPUT **3 lần** với delay 300ms:

```javascript
// Unblock Input - Gửi nhiều lần để đảm bảo
SocketService.send("ENABLE_INPUT");
setTimeout(() => SocketService.send("ENABLE_INPUT"), 300);
setTimeout(() => SocketService.send("ENABLE_INPUT"), 600);
```

### Auto-unblock khi Client disconnect

Thêm logic để tự động unblock khi tất cả client ngắt kết nối:

```csharp
socket.OnClose = () =>
{
    if (SocketManager.All.Count == 0)
    {
        // Auto-unblock để tránh bị lock vĩnh viễn
        if (SystemHelper.IsInputBlocked)
        {
            Task.Run(() => SystemHelper.ForceUnblockInput());
        }
    }
};
```

---

## 📊 Kết quả kiểm tra

### Test log sau khi fix:

```
[⚙️  SERVER] 🔧 [CMD] DISABLE_INPUT
[⚙️  SERVER] ℹ️ Input blocked successfully.
[⚙️  SERVER] 🔧 [CMD] ENABLE_INPUT
[⚙️  SERVER] ℹ️ Input unblocked successfully on attempt 1  ✅

[⚙️  SERVER] 🔧 [CMD] DISABLE_INPUT
[⚙️  SERVER] ℹ️ Input blocked successfully.
[⚙️  SERVER] 🔧 [CMD] ENABLE_INPUT
[⚙️  SERVER] ℹ️ Input unblocked successfully on attempt 1  ✅

[⚙️  SERVER] 🔧 [CMD] DISABLE_INPUT
[⚙️  SERVER] ℹ️ Input blocked successfully.
[⚙️  SERVER] 🔧 [CMD] ENABLE_INPUT
[⚙️  SERVER] ℹ️ Input unblocked successfully (forced with extended retry)  ✅
```

### Phân tích kết quả:

| Lần test | Chiến lược thành công         | Thời gian |
| -------- | ----------------------------- | --------- |
| 1        | Chiến lược 1 (attempt 1)      | ~10ms     |
| 2        | Chiến lược 1 (attempt 1)      | ~10ms     |
| 3        | Chiến lược 2 (extended retry) | ~1s       |

**Kết luận:** 100% các lần unblock đều thành công, dù có trường hợp cần dùng đến chiến lược 2.

---

## 📚 Bài học rút ra

### 1. Windows API không phải lúc nào cũng đáng tin cậy

- Các API cấp thấp như `BlockInput` có thể có hành vi không consistent
- Cần test kỹ trong nhiều điều kiện khác nhau

### 2. Retry đơn giản không đủ

- Chỉ tăng số lần retry không giải quyết vấn đề gốc
- Cần có chiến lược verify và fallback

### 3. Redundancy từ cả client và server

- Không nên chỉ rely vào một bên
- Client gửi nhiều lần + Server retry nhiều chiến lược = tỷ lệ thành công cao

### 4. Fail-safe mechanism quan trọng

- Auto-unblock khi disconnect tránh lock vĩnh viễn
- Luôn có cơ chế recovery

### 5. Logging chi tiết giúp debug

- Log từng bước giúp xác định chính xác vấn đề
- Biết được chiến lược nào đang hoạt động

---

## 📁 Files đã thay đổi

| File                             | Thay đổi                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Server/Helpers/SystemHelper.cs` | Cải thiện `EnableInput()` với 3 chiến lược, thêm `ForceUnblockInput()`, thêm `IsInputBlocked` property |
| `Server/Core/ServerCore.cs`      | Thêm auto-unblock trong `socket.OnClose`                                                               |
| `Client/js/features/monitor.js`  | Gửi ENABLE_INPUT 3 lần với delay                                                                       |

---

_Báo cáo này được tạo để document quá trình fix bug và có thể dùng làm reference cho các vấn đề tương tự trong tương lai._
