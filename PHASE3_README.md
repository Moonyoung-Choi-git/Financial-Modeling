# FMWP Phase 3: 3-Statement Modeling Engine (MVP)

## 📋 구현 완료 항목

### Section 5: 3-Statement Modeling Engine (MVP)

#### ✅ 5.1 Period Index & Timeline ([lib/modeling/timeline-builder.ts](lib/modeling/timeline-builder.ts))
- **Period Index 시스템**: 통일된 0-based 인덱스로 historical/forecast 기간 관리
  - Index 0부터 시작 (예: 0=FY2019, 1=FY2020, ..., 5=FY2024E)
  - Period 타입: `{ index, fiscalYear, fiscalQuarter, periodType, isHistorical, label }`

- **Timeline Builder**:
  - Historical + Forecast 기간 자동 생성
  - ANNUAL 지원 (QUARTER는 Phase 3.5로 연기)
  - 명확한 기간 라벨링: "FY2023", "FY2024E"

#### ✅ 5.2 Historical Data Loader ([lib/modeling/historical-loader.ts](lib/modeling/historical-loader.ts))
- **Curated Facts → Model Timeline 변환**:
  - `Map<standardLineId, Map<periodIndex, Decimal>>` 구조
  - fiscal_year → period_index 매핑
  - 누락된 기간 자동 감지

- **getHistoricalValue()**: 특정 line/period 값 조회 헬퍼

#### ✅ 5.3-5.5 Statement Builders ([lib/modeling/simple-builder.ts](lib/modeling/simple-builder.ts))
- **Income Statement Builder**:
  - 10개 표준 라인 (Revenue → Net Income)
  - Historical: Curated Facts에서 로드
  - Forecast (MVP): 마지막 Historical 값 반복 (Flat projection)

- **Balance Sheet Builder**:
  - 19개 표준 라인 (Assets, Liabilities, Equity)
  - Historical: Curated Facts에서 로드
  - Forecast (MVP): 마지막 Historical 값 반복

- **Cash Flow Builder**:
  - 6개 표준 라인 (CFO, CFI, CFF, Net Change, Beginning/Ending Cash)
  - Historical: Curated Facts에서 로드
  - Forecast (MVP): 마지막 Historical 값 반복

#### ✅ 5.6 Model Checks ([lib/modeling/simple-builder.ts](lib/modeling/simple-builder.ts))
- **BS Balance Check**: Assets = Liabilities + Equity
  - Tolerance: 1원 이내 허용
  - 모든 period에 대해 검증

- **CF Tie-out Check**: Ending Cash = Beginning Cash + Net Change
  - Tolerance: 1원 이내 허용
  - 현금 흐름 정합성 검증

#### ✅ 5.7 Model Snapshot Persistence ([lib/modeling/snapshot-saver.ts](lib/modeling/snapshot-saver.ts))
- **Database 저장**:
  - ModelSnapshot 레코드 생성 (metadata, hash, version)
  - ModelOutputLine 레코드 일괄 생성 (모든 statement lines)
  - Batch insert로 성능 최적화

- **Snapshot Metadata**:
  - snapshotId, snapshotHash (SHA-256)
  - calcEngineVersion (0.1.0-mvp)
  - usedRceptNoList (향후 확장)
  - createdAt

#### ✅ Worker 통합
- `BuildModelSnapshotJob` 구현 완료
- Input: `{ entityId, baseYear, historicalYears, forecastYears }`
- Output: `{ snapshotId, linesCreated, checksPass, bsBalanceCheck, cfTieOut }`
- 자동 model checks 실행 및 결과 리포트

---

## 🚀 사용 방법

### 1. 전체 파이프라인 실행 (Stock Code → Model Snapshot)

```bash
# Terminal 1: Worker 실행
npm run worker

# Terminal 2: Job 등록 (Raw → Curated → Model)
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

// 1. Raw 데이터 수집
queue.add('FetchByStockCodeJob', {
  stockCode: '005930',  // 삼성전자
  years: [2020, 2021, 2022, 2023, 2024]
});

// 2. Curate는 자동 trigger됨 (FetchFinancialAllJob 완료 시)

// 3. Model 빌드는 curate 완료 후 수동 실행 또는:
// queue.add('BuildModelSnapshotJob', {
//   entityId: '<entity-id>',  // curate 결과에서 확인
//   baseYear: 2024,
//   historicalYears: 5,
//   forecastYears: 5
// });
"
```

**파이프라인 흐름**:
1. `FetchByStockCodeJob` → stock_code → corp_code 조회
2. `FetchMultiYearFinancialsJob` → Raw 데이터 수집
3. `CurateTransformJob` (자동 trigger) → Curated Facts 생성
4. `BuildModelSnapshotJob` (수동 또는 자동) → 3-Statement Model 생성

### 2. 수동으로 Model 빌드

Curated Facts가 이미 있는 경우:

```bash
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

queue.add('BuildModelSnapshotJob', {
  entityId: '<entity-id>',  // ModelEntity.id
  baseYear: 2024,
  historicalYears: 5,       // 5년 실적 (2020-2024)
  forecastYears: 5          // 5년 예측 (2025-2029)
});
"
```

### 3. 테스트 스크립트 실행

```bash
# 자동으로 첫 번째 entity 찾아서 모델 빌드
npx tsx test-model.ts

# 특정 entity로 테스트
npx tsx test-model.ts <entity-id> 2024 5 5
```

**출력 예시**:
```
================================================================================
FMWP 3-Statement Model Builder Test
================================================================================
✅ Using entity: 삼성전자 (00126380)
   Entity ID: abc-123-def

Timeline: 5 historical + 5 forecast years
Base Year: 2024
================================================================================

📊 Available Curated Facts: 2,500 rows

[1/2] Building 3-Statement Model...

✅ Model Built Successfully!
   Snapshot ID: snapshot-1738210800000-a1b2c3d4
   Engine Version: 0.1.0-mvp
   Build Duration: 1234ms

📊 Statement Summary:
   Income Statement: 10 lines
   Balance Sheet: 19 lines
   Cash Flow: 6 lines
   Total Periods: 10
   Historical: 5, Forecast: 5

📈 Sample Income Statement Values (Revenue):
   FY2020: 236806000000000 KRW
   FY2021: 279600000000000 KRW
   FY2022: 302231000000000 KRW
   FY2023: 258940000000000 KRW
   FY2024: 258940000000000 KRW
   FY2025E: 258940000000000 KRW
   FY2026E: 258940000000000 KRW
   FY2027E: 258940000000000 KRW
   FY2028E: 258940000000000 KRW
   FY2029E: 258940000000000 KRW

🔍 Model Integrity Checks:
   BS Balance Check: ✅ PASS (max error: 0.00)
   CF Tie-out Check: ✅ PASS (max error: 0.00)
   Overall: ✅ ALL CHECKS PASSED

[2/2] Saving Model Snapshot to Database...

✅ Model Snapshot Saved!
   Snapshot ID: snapshot-1738210800000-a1b2c3d4
   Output Lines Saved: 350
   Save Duration: 456ms

🔍 Database Verification:
   Snapshot Record: ✅ Found
   Output Lines in DB: 350

================================================================================
✅ Test completed successfully!
================================================================================
```

---

## 📊 데이터베이스 확인

### Model Snapshot 조회

```sql
-- 특정 기업의 Model Snapshot 목록
SELECT
  id,
  entity_id,
  calc_engine_version,
  snapshot_hash,
  created_at
FROM model_snapshots
WHERE entity_id = '<entity-id>'
ORDER BY created_at DESC;
```

### Model Output Lines 조회

```sql
-- 특정 snapshot의 모든 output lines
SELECT
  statement_type,
  standard_line_id,
  period_index,
  fiscal_year,
  value,
  is_historical,
  provenance
FROM model_output_lines
WHERE snapshot_id = '<snapshot-id>'
ORDER BY statement_type, display_order, period_index;
```

### Income Statement 확인

```sql
-- 특정 snapshot의 Income Statement만 조회
SELECT
  standard_line_id,
  fiscal_year,
  value,
  is_historical
FROM model_output_lines
WHERE snapshot_id = '<snapshot-id>'
  AND statement_type = 'IS'
ORDER BY display_order, period_index;
```

### Balance Sheet Check 검증

```sql
-- BS Balance 검증 (Assets = Liabilities + Equity)
WITH bs_totals AS (
  SELECT
    period_index,
    fiscal_year,
    MAX(CASE WHEN standard_line_id = 'BS.TOTAL_ASSETS' THEN value END) as assets,
    MAX(CASE WHEN standard_line_id = 'BS.TOTAL_LIABILITIES' THEN value END) as liabilities,
    MAX(CASE WHEN standard_line_id = 'BS.TOTAL_EQUITY' THEN value END) as equity
  FROM model_output_lines
  WHERE snapshot_id = '<snapshot-id>'
    AND statement_type = 'BS'
  GROUP BY period_index, fiscal_year
)
SELECT
  fiscal_year,
  assets,
  liabilities,
  equity,
  liabilities + equity as liab_plus_equity,
  assets - (liabilities + equity) as difference
FROM bs_totals
ORDER BY fiscal_year;
```

---

## 🎯 MVP vs Full Engine 비교

### ✅ MVP 구현 (Phase 3 - 완료)
- ✅ Historical data populate (Curated → Timeline)
- ✅ Period index system (0-based unified indexing)
- ✅ 3-Statement structure (IS/BS/CF)
- ✅ Simple forecast: **Flat projection** (마지막 historical 반복)
- ✅ Model checks (BS Balance, CF Tie-out)
- ✅ Snapshot persistence (ModelSnapshot + ModelOutputLine)
- ✅ Worker integration (BuildModelSnapshotJob)

### 🔜 Full Engine (Phase 3.5 - 연기)
- ⏳ Revenue drivers:
  - Growth rate method
  - Price × Volume method
  - Segment-based forecast

- ⏳ Cost drivers:
  - COGS: % of Revenue or Fixed+Variable
  - SG&A: % of Revenue or Absolute
  - D&A: Based on capex schedule

- ⏳ Working Capital schedules:
  - AR: DSO method
  - Inventory: DIO method
  - AP: DPO method

- ⏳ Capex & PP&E roll-forward:
  - Capex forecast (% of Revenue or Absolute)
  - Depreciation schedule
  - PP&E balance calculation

- ⏳ Debt & Interest:
  - Interest calculation (debt × rate)
  - Debt repayment schedule
  - Revolver plug for cash shortfalls

- ⏳ Cash Flow (Indirect method):
  - Net Income → CFO conversion
  - NWC changes
  - Capex, debt issuance/repayment

- ⏳ Plug mechanism:
  - Cash surplus/deficit detection
  - Revolver draw/paydown
  - Circularity resolution

---

## 🔧 현재 MVP의 한계

### 1. Forecast가 단순함
- **현재**: 마지막 historical 값을 그대로 반복
- **문제**: 성장, 마진 변화, 계절성 등 반영 안 됨
- **해결**: Phase 3.5에서 driver-based forecast 구현

### 2. Working Capital 미반영
- **현재**: BS의 AR/Inventory/AP가 flat projection
- **문제**: 매출 변화 시 WC 변동 반영 안 됨
- **해결**: Phase 3.5에서 DSO/DIO/DPO 기반 계산

### 3. Capex & PP&E 미반영
- **현재**: PP&E가 flat projection
- **문제**: Capex 투자, 감가상각 누적 효과 없음
- **해결**: Phase 3.5에서 PP&E roll-forward 구현

### 4. 이자비용 미계산
- **현재**: Interest Expense가 flat projection
- **문제**: 부채 잔액 변화와 무관
- **해결**: Phase 3.5에서 Debt × Interest Rate 계산

### 5. Cash Flow가 직접 입력
- **현재**: CF는 curated facts를 그대로 사용
- **문제**: IS/BS 변화와 연동 안 됨 (Indirect method 미구현)
- **해결**: Phase 3.5에서 Indirect CF 자동 계산

---

## 📈 데이터 품질 확인

### Model Checks 통계

```sql
-- 최근 생성된 snapshot들의 checks 통과율
-- (현재 checks는 ModelSnapshot에 저장 안 되므로, job result 로그에서 확인)

-- Output lines 생성 통계
SELECT
  s.id,
  s.calc_engine_version,
  COUNT(ol.id) as total_lines,
  COUNT(DISTINCT ol.statement_type) as statement_count,
  COUNT(DISTINCT ol.period_index) as period_count,
  s.created_at
FROM model_snapshots s
LEFT JOIN model_output_lines ol ON ol.snapshot_id = s.id
GROUP BY s.id, s.calc_engine_version, s.created_at
ORDER BY s.created_at DESC
LIMIT 10;
```

### Period Coverage

```sql
-- 특정 snapshot의 period별 라인 수
SELECT
  period_index,
  fiscal_year,
  is_historical,
  COUNT(*) as line_count
FROM model_output_lines
WHERE snapshot_id = '<snapshot-id>'
GROUP BY period_index, fiscal_year, is_historical
ORDER BY period_index;
```

---

## 🎯 다음 단계 (Phase 3.5: Full Forecast Engine)

### 1. Revenue Forecast
- Growth rate 입력 → Revenue projection
- Price × Volume decomposition (optional)
- Segment별 forecast (향후)

### 2. Cost Forecast
- COGS: % of Revenue
- SG&A: % of Revenue or Absolute
- D&A: Capex schedule 기반

### 3. Working Capital
- AR = Revenue × (DSO/365)
- Inventory = COGS × (DIO/365)
- AP = COGS × (DPO/365)
- NWC Change → CF 영향

### 4. Capex & PP&E
- Capex forecast (% of Revenue or Absolute)
- PP&E = PP&E_prev + Capex - D&A
- D&A = f(PP&E, useful life)

### 5. Debt & Interest
- Interest Expense = Debt_avg × Interest Rate
- Debt repayment schedule
- Revolver plug for cash shortfall

### 6. Cash Flow (Indirect)
- CFO = Net Income + D&A - ΔAR - ΔInventory + ΔAP
- CFI = -Capex
- CFF = ΔDebt + Dividends
- Net Change = CFO + CFI + CFF
- Ending Cash = Beginning Cash + Net Change

### 7. Circularity
- Interest depends on Debt
- Debt depends on Cash (plug)
- Cash depends on Interest (via Net Income)
- → Iterative solver 필요

---

## 🐛 문제 해결

### "No curated facts found" 오류

Curated Facts가 없으면 Model을 빌드할 수 없습니다. 먼저 curate:

```bash
npx tsx test-curate.ts <corpCode> <year> <reportCode> <fsDiv>
```

### "Entity not found" 오류

ModelEntity가 없으면 curate 단계에서 자동 생성됩니다. corp_master에 corp_code가 있는지 확인:

```sql
SELECT * FROM corp_master WHERE corp_code = '<corp-code>';
```

없으면 먼저 SyncCorpMasterJob 실행.

### Model Checks 실패

BS Balance Check 또는 CF Tie-out Check가 실패하면:

1. Curated Facts 품질 확인:
   ```sql
   SELECT
     statement_type,
     COUNT(*) as total,
     COUNT(standard_line_id) as mapped
   FROM curated_fin_facts
   WHERE entity_id = '<entity-id>'
     AND fiscal_year = 2024
   GROUP BY statement_type;
   ```

2. 특정 라인이 누락되었는지 확인:
   ```sql
   SELECT DISTINCT standard_line_id
   FROM curated_fin_facts
   WHERE entity_id = '<entity-id>'
     AND fiscal_year = 2024
     AND statement_type = 'BS'
   ORDER BY standard_line_id;
   ```

3. Unmapped accounts 추가 (PHASE2_README.md 참고)

---

## 📚 관련 파일

- [lib/modeling/model-types.ts](lib/modeling/model-types.ts) - Type definitions
- [lib/modeling/timeline-builder.ts](lib/modeling/timeline-builder.ts) - Period index system
- [lib/modeling/historical-loader.ts](lib/modeling/historical-loader.ts) - Curated → Timeline
- [lib/modeling/simple-builder.ts](lib/modeling/simple-builder.ts) - MVP model builder
- [lib/modeling/snapshot-saver.ts](lib/modeling/snapshot-saver.ts) - DB persistence
- [lib/modeling/index.ts](lib/modeling/index.ts) - Module exports
- [worker.ts](worker.ts) - BuildModelSnapshotJob 구현
- [test-model.ts](test-model.ts) - 테스트 스크립트
- [schema.prisma](schema.prisma) - Model 스키마 (model_snapshots, model_output_lines)

---

**Phase 3 MVP 구현 완료!** 🎉

다음은 Phase 3.5: Full Forecast Engine 또는 Phase 4: Viewer/Export 구현입니다.

## MVP 사용 사례

현재 MVP로 가능한 것:
1. ✅ Historical 재무제표 표준화 (Curated Facts 기반)
2. ✅ Simple forecast (flat projection) - 빠른 프로토타이핑용
3. ✅ Model integrity checks (BS/CF 정합성)
4. ✅ Snapshot versioning & reproducibility
5. ✅ 데이터베이스 기반 모델 저장/조회

MVP의 주요 목적:
- ✅ End-to-end 파이프라인 검증 (Raw → Curated → Model → DB)
- ✅ 인프라 안정성 확인 (Period Index, DB schema, Worker)
- ✅ Phase 3.5 Full Engine을 위한 foundation

---

## 성능 벤치마크 (예상)

| Metric | MVP | Target (Full Engine) |
|--------|-----|---------------------|
| 모델 빌드 시간 | ~1-2초 | ~5-10초 (circularity) |
| DB 저장 시간 | ~0.5초 | ~1-2초 |
| Output Lines | ~350 (10yr × 35 lines) | ~500+ (schedules 포함) |
| Memory Usage | ~50MB | ~100-200MB |

---
