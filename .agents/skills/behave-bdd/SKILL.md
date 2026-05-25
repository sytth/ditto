---
name: behave-bdd
description: 使用 Python Behave 框架執行行為驅動開發 (BDD) 的專業技能。包含建立 Gherkin feature 文件、實作 step definitions 及對應測試邏輯。當專案需要透過行為驅動方式撰寫及執行測試案例時觸發此技能。
---

# Behave BDD 測試技能

本技能提供在專案中使用 [behave](https://behave.readthedocs.io/en/latest/) 進行行為驅動開發 (BDD) 的標準作業準則與最佳實踐。

## 目錄結構慣例

標準的 behave 測試應具備以下目錄與檔案配置，請務必建立在專案的合適位置（通常為根目錄下）：
```
專案根目錄/
└── features/
    ├── example.feature      # Gherkin 格式的測試情境
    ├── environment.py       # (選用) 環境設置與 Hooks (before_all, after_all)
    └── steps/               # Step definitions 放這裡
        └── example_steps.py # Python 實作的測試步驟邏輯
```

## 工作流程

1. **定義 Feature 檔案 (`features/*.feature`)**
   - 檔名使用有意義的小寫英數字加底線。
   - 使用標準 Gherkin 語法：`Feature:`, `Scenario:`, `Given`, `When`, `Then`, `And`, `But`。
   - 語言設定盡量保持一致，每個 Scenario 只專注測試一種使用情境。

2. **實作 Step Definitions (`features/steps/*_steps.py`)**
   - 匯入 behave 的修飾器：`from behave import given, when, then, step`。
   - Step 函式的第一個參數必須是 `context`，用來在不同的 step 之間傳遞資料或保存狀態。

3. **執行測試**
   - 在專案根目錄（或 features 的上層目錄）於終端機執行指令：`behave`。
   - 若要執行特定 feature 檔案：`behave features/example.feature`。

## Gherkin 語法範例

請參考下方的音樂清單範例，保持語句如自然對話般通順：

```gherkin
Feature: 音樂播放控制
  為了讓使用者享受流暢的音樂體驗
  系統應該可以順利從清單中播放及切換樂曲

  Scenario: 播放音樂清單中的歌曲
    Given 使用者已經登入系統
    And 音樂清單「我的最愛」內有數首歌曲
    When 使用者按下播放鍵
    Then 系統應該開始播放第一首歌曲
```

## Step Definition 實作範例

對應上方情境的 Python 實作程式碼：

```python
from behave import given, when, then

@given('使用者已經登入系統')
def step_impl(context):
    context.user = build_mock_user(authenticated=True)
    assert context.user.is_authenticated is True

@when('使用者按下播放鍵')
def step_impl(context):
    context.playback_result = context.user.press_play()

@then('系統應該開始播放第一首歌曲')
def step_impl(context):
    assert context.playback_result.status == "playing"
    assert context.playback_result.track_index == 0
```

## 進階：Environment Hooks

環境設定 (`features/environment.py`) 可用來控制測試執行前後的動作，例如初始化資料庫與收尾：

```python
def before_all(context):
    # 所有測試啟動前執行一次（例如初始化瀏覽器、資料庫連線）
    context.db = initialize_database()

def after_all(context):
    # 所有測試結束後執行
    context.db.close()
    
def before_scenario(context, scenario):
    # 每個小情境 (Scenario) 開始前執行
    clear_database_tables()
```

## 常見陷阱與開發建議

1. **參數化 Step**：利用變數來減少重複開發。例如用 `{count:d}`：
   ```python
   @given('我有 {count:d} 首歌曲')
   def step_impl(context, count):
       context.songs_count = count
   ```
2. **斷言 (Assertion)**：在 Python 裡直接使用標準的 `assert` 來驗證條件。如果發生 assert 錯誤，behave 會擷取錯誤並將該 step 標示為 failed。
3. **隔離性**：請保證每個 Scenario 的獨立性。一個 Scenario 理應不要依賴上一個 Scenario 留下來的狀態以避免非預期連鎖錯誤。
4. **保持簡單**：Step function 應該盡可能簡短。將複雜的業務邏輯或外部 API 呼叫解耦，放置在外部模組並於 step 內匯入使用。
