# 技術筆記

## 資料來源

機台上的 LINE Pay QR 解出來是 `https://wipepay.com.tw/v1/linepay/<mac>/`，
會 302 轉到 `https://wipepay.com.tw/v2/machine/<mac>/`（廠商：捷奏數科 Beat Digital Solutions）。

那頁是 Vue 3 SPA，即時狀態不走 HTTP，走 **MQTT over WebSocket**：

- Broker：`wss://wipepay.com.tw:443/mqtt/`（**匿名，不需帳密**）
- Topic：`machine/<mac>/status/#`
- 訊息為 **retained**，訂閱後立即收到目前狀態，之後約每 4 秒更新

訊息格式：

```json
{ "type": "status", "ts": 1788900000, "status": 2176, "timeLeft": 1255 }
```

`/api/machine/?mac=<mac>` 只回機台身分（id、名稱、店家），**不含狀態**。

## 狀態碼

`status` 是 16-bit 混合碼：**高位元組為主狀態、低位元組為子狀態**，判斷只看主狀態。
伺服器 watchdog 發布的 `-1` 不是機器回報的碼，不做位移。

| 主狀態 | 意義 | | 主狀態 | 意義 |
|---|---|---|---|---|
| -1 | 失聯（watchdog） | | 8 | 運轉中（有倒數） |
| 0 / 1 | 閒置 | | 9 / 10 | 鎖門／開鎖中 |
| 2 | 等待付款 | | 11 | 暫停 |
| 4 / 5 | 等待操作 | | 12 | 完成 |
| 128 | 錯誤 | | | |

子狀態是 bitmask（1 加值付款、2 門開著、8 手動模式、32 鎖定行程、128 不可用）。
洗衣機運轉中常帶子狀態 128，屬正常。

`timeLeft` 只有計時類狀態才會帶。運轉中要扣掉在途時間（`now - ts`）才是真正剩餘秒數；
暫停／鎖門的 `timeLeft` 是機台凍結值，直接採用。

## 機台編號

MAC 前綴 `94c96001b3` 是廠商的裝置編號段（同前綴 223 台、全系統約 900 台），
**跟店家無關**，要靠 `/api/machine/` 回傳的 `store` 判斷（碩齋屬 store 8「清華」）。

| 機台 | MAC | id | | 機台 | MAC | id |
|---|---|---|---|---|---|---|
| 洗 1 | 94c96001b3d9 | 129 | | 烘 1 | 94c96001b3af | 184 |
| 洗 2 | 94c96001b3ef | 130 | | 烘 2 | 94c96001b399 | 185 |
| 洗 3 | 94c96001b3ee | 131 | | 烘 3 | 94c96001b398 | 186 |
| 洗 4 | 94c96001b3ff | 132 | | 烘 4 | 94c96001b3aa | 187 |
| 洗 5 | 94c96001b3d8 | 133 | | | | |
| 洗 6 | 94c96001b3dc | 134 | | | | |

烘 2 的 QR 貼紙毀損，是用 MQTT 萬用字元 `machine/+/status/#` 列出同前綴機台後，
逐一查 `/api/machine/` 比對名稱找出來的；id 185 剛好落在烘 1（184）與烘 3（186）之間，
可以交叉驗證。

## 注意

- 本專案只做**唯讀訂閱**，不碰 `/api/machine/createOrder/`、`confirmOrder/` 等付款端點。
- 廠商本身有 Web Push 通知（`/api/notify/subscribe/machine/`，VAPID），
  但只能單台訂閱，解決不了「哪台是空的」的總覽需求。
