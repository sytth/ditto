# Ditto 專案雲端部署指南

本文件引導您將 Ditto 專案從本機開發環境部署至雲端生產環境。

## 部署架構說明

因為本專案包含兩個主要部分，且後端使用了 Express 伺服器與 Socket.io (WebSocket) 即時通訊技術，因此無法將兩者全部部署在 Vercel 上。
- **前端 (Next.js)**：非常適合部署在 **Vercel**。
- **後端 (Express & WebSocket)**：Vercel 的 Serverless Functions 無法維持持久的 TCP 連線，因此不支持 WebSocket。後端必須部署在支持長連線運行的容器平台，例如 **Render** 或 **Railway**。
- **資料庫 (PostgreSQL)**：已託管於 Neon.tech 雲端，無需遷移，僅需讓後端正確連接即可。

---

## 第一部分：代碼準備工作 (已完成)

為了支持雲端部署，本機代碼已進行以下更新：
1. **配置動態 API 網址**：在 `frontend/app/config.ts` 中建立了 `API_URL` 設定，會優先讀取環境變數 `NEXT_PUBLIC_API_URL`，若無則回退至本機 `http://localhost:4000`。
2. **更換前端請求端點**：已將首頁、註冊頁、選歌頁與配對頁的硬編碼 API 請求路徑全部改為使用 `API_URL`。
3. **優化後端編譯腳本**：修改了 `backend/package.json` 中的 `build` 指令為 `"build": "npx prisma generate && tsc"`，確保雲端平台編譯時會先產生資料庫 Client 類型再進行 TypeScript 編譯。

---

## 第二部分：部署後端伺服器 (以 Render 平台為例)

Render 提供了便利的 GitHub 連動部署，請按照以下步驟操作：

1. **註冊並登入 Render**：
   - 前往 Render 官網並使用您的 GitHub 帳號註冊登入。

2. **建立 Web Service**：
   - 點擊「New」並選擇「Web Service」。
   - 選擇「Build and deploy from a Git repository」，並連結您的 Ditto 專案 Repo。

3. **配置服務設定**：
   - **Name**：輸入您的服務名稱 (例如 `ditto-backend`)。
   - **Region**：選擇距離您較近的區域 (例如 Singapore)。
   - **Branch**：選擇您要部署的分支 (通常為 `main`)。
   - **Root Directory**：輸入 `backend` (非常重要，這會讓 Render 只編譯後端目錄)。
   - **Runtime**：選擇 `Node`。
   - **Build Command**：輸入 `npm install && npm run build`。
   - **Start Command**：輸入 `npm start`。

4. **配置環境變數 (Environment Variables)**：
   - 在下方展開環境變數設定，點擊「Add Environment Variable」加入以下變數：
     - `DATABASE_URL`：請輸入您的 Neon.tech 資料庫連接字串 (格式為 `postgresql://...`)。
   - 點擊「Create Web Service」開始編譯部署。

5. **獲取後端網址**：
   - 部署完成後，在 Render 控制台頂部會看到一串產生的專屬網址，格式為 `https://your-service-name.onrender.com`。請複製此網址，我們將在第三部分使用它。

---

## 第三部分：部署前端網頁 (於 Vercel)

Vercel 是 Next.js 的官方託管平台，部署流程如下：

1. **註冊並登入 Vercel**：
   - 前往 Vercel 官網並使用您的 GitHub 帳號登入。

2. **匯入專案 (Import Project)**：
   - 點擊「Add New...」選擇「Project」。
   - 匯入您的 Ditto 專案 Repo。

3. **配置專案設定**：
   - **Project Name**：自訂您的專案名稱。
   - **Framework Preset**：選擇 `Next.js`。
   - **Root Directory**：點擊「Edit」並選擇 `frontend` 資料夾 (這會讓 Vercel 將編譯起點設在前端)。

4. **配置環境變數 (Environment Variables)**：
   - 展開「Environment Variables」區塊，新增以下變數：
     - **Key**：`NEXT_PUBLIC_API_URL`
     - **Value**：請貼上您在第二部分複製的 **Render 後端網址** (結尾請勿加上斜線 `/`，例如 `https://ditto-backend.onrender.com`)。

5. **部署**：
   - 點擊「Deploy」按鈕。Vercel 將會自動安裝依賴、建置 Next.js 並發佈。
   - 部署完成後，您會獲得一個 Vercel 提供的公開網址 (例如 `https://ditto-frontend.vercel.app`)。

---

## 第四部分：驗證與生產環境測試

部署完成後，您可以進行以下步驟驗證系統的雲端運行狀況：

1. **開啟前端公開網址**。
2. **註冊新帳號**：確認引導頁面的註冊請求能夠成功送至 Render 後端，且資料正確寫入雲端 Neon.tech 資料庫，並跳轉至選歌頁面。
3. **建立今日卡片**：嘗試在搜尋欄中搜尋歌曲（確認 iTunes API 代理連通），選定 5 首並成功儲存卡片回到首頁。
4. **進入配對**：點擊配對按鈕，確認能正確載入其他用戶的品味卡片，且左右滑動與 Vibe 分數計算皆正常運行。
