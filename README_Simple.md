# OmniSuite AI - Simple Guide

## ⚠️ Cảnh báo: KHÔNG tải file .zip từ GitHub

| Cách tải | Kết quả |
|----------|---------|
| **Download ZIP** trên GitHub | Thư mục `integrations/...` (OpenManus, browser-use, Crawl4AI…) **trống** — GitHub không gói submodule vào file zip. |
| **`git clone`** (khuyến nghị) | Đủ để dùng OmniSuite; bot AI tải **khi cần** (xem bên dưới). |

**Sau khi tải zip, app SEO / Quản gia chat vẫn chạy được**, nhưng **`/run`, `/run-browser` và các gói integration chưa có sẵn** cho đến khi bạn tải thêm (cần cài **Git** trên máy).

**Nếu đã tải zip rồi** — chọn một cách:

1. Clone lại bằng Git (dễ nhất): xóa folder cũ → `git clone https://github.com/NgoMinhHai-arch/OmniSuite.git`
2. Giữ folder zip, cài [Git](https://git-scm.com/), mở PowerShell trong folder OmniSuite:
   ```
   npm run integrations:fetch -- open_manus
   npm run integrations:fetch -- browser_use
   ```
3. Trong **Quản gia** (`/dashboard/ai-support`): lần đầu gõ `/run` hoặc `/run-browser` → app **tự tải** gói tương ứng (cần Git + mạng).

Gõ `/tai-bang` trong Quản gia để xem gói nào **đã tải** / **chưa tải** trên máy.

---

## 🚀 How to Run (NO CODING KNOWLEDGE REQUIRED)

### 1. Download (dùng Git clone — không dùng ZIP)

Open Command Prompt/PowerShell and run:

```
git clone https://github.com/NgoMinhHai-arch/OmniSuite.git
cd OmniSuite
npm install
```

**Do not** use “Download ZIP” on GitHub for OmniSuite (integrations folders will be empty).

Quản gia AI (`/run`, `/run-browser`…): **lần đầu bạn dùng lệnh nào thì mới tải gói đó** (~vài trăm MB), không cài sẵn lúc mở app. Cần **Git** đã cài trên Windows.

### 2. Run
Go to the downloaded folder → **Double-click** `01_START_OMNISUITE.bat`

### 3. Configuration (First time)
- The browser will open automatically
- Click **Settings** (gear icon)
- Enter your API keys (OpenAI, Gemini, etc.)
- Save

### 4. Start Using!
(If you have questions, please ask Windsurf or your IDE, don't ask me!)

## 🗑️ How to Delete
Delete the folder = Delete everything (keeps no trace/files on your system)

## 🤖 Quản gia — tải gói bot (tóm tắt)

| Lệnh | Việc làm |
|------|----------|
| `/tai-bang` | Bảng đã tải / chưa tải |
| `/tai` | Hướng dẫn tải từng gói |
| `/integrations` | Danh sách + link GitHub |
| `/run` | Tự tải OpenManus lần đầu |
| `/run-browser` | Tự tải browser-use lần đầu |

Tải tay (PowerShell trong folder OmniSuite): `npm run integrations:fetch -- <tên_gói>`  
Ví dụ: `open_manus`, `browser_use`, `crawl4ai`, `activepieces` — xem đầy đủ: `npm run integrations:fetch -- --list`

---

## ❓ Need Help?
Where to get API keys:
- OpenAI: https://platform.openai.com/api-keys
- Gemini: https://aistudio.google.com/app/apikey
- SerpAPI: https://serpapi.com/manage-api-key
