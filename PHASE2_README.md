# FMWP Phase 2: Curated Layer 구현 완료

## 📋 구현 완료 항목

### Section 4: ETL/정규화 로직 (Raw → Curated)

#### ✅ 4.1 공통 정규화 ([lib/curate/normalizer.ts](lib/curate/normalizer.ts))
- **숫자 파싱**: "9,999,999,999" → NUMERIC
  - 콤마(,) 제거
  - 괄호 (xxx) → 음수 처리
  - 공백 제거
  - 단위 문자 제거 (원, 천원 등)

- **기간 정규화**:
  - BS: 시점 금액 (as_of_date)
  - IS/CF: 기간 금액 (flow_start_date, flow_end_date)
  - 분/반기 처리: thstrm_amount (3개월) vs thstrm_add_amount (누적)

- **통화 정규화**: KRW/USD 표준화

#### ✅ 4.2 계정 매핑 엔진 ([lib/curate/mapper.ts](lib/curate/mapper.ts))
- **매핑 단계** (명세서 Section 4.2):
  1. account_id exact match (최고 신뢰도)
  2. account_nm exact match + statement_type
  3. account_nm regex match + statement_type
  4. UNMAPPED 처리

- **매핑 커버리지 리포트**:
  - 기업별/연도별 커버리지 %
  - Statement별 통계
  - Top N 미매핑 계정 추천

- **캐시 시스템**: 5분 TTL 매핑 룰 캐시

#### ✅ 4.3 통합 Transform 파이프라인 ([lib/curate/transform.ts](lib/curate/transform.ts))
- Raw → Curated 전체 변환 프로세스
- Entity 자동 생성/조회
- Upsert 기반 중복 방지
- 일괄 변환 지원 (다년도/다보고서)

#### ✅ Worker 통합
- `CurateTransformJob` 구현 완료
- `FetchFinancialAllJob` 완료 시 자동 trigger

---

## 🚀 사용 방법

### 1. 전체 파이프라인 실행 (Stock Code → Curated Facts)

```bash
# Terminal 1: Worker 실행
npm run worker

# Terminal 2: Job 등록
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

// 종목코드로 Raw 데이터 수집 + 자동 Curate
queue.add('FetchByStockCodeJob', {
  stockCode: '005930',  // 삼성전자
  years: [2023, 2024]
});
"
```

**파이프라인 흐름**:
1. `FetchByStockCodeJob` → stock_code → corp_code 조회
2. `FetchMultiYearFinancialsJob` → Raw 데이터 수집 (raw_dart_fnltt_all_rows)
3. `FetchFinancialAllJob` (각 year/report) → 완료 시 자동 trigger
4. `CurateTransformJob` → Raw → Curated 변환 (curated_fin_facts)

### 2. 수동으로 Curate 실행

Raw 데이터가 이미 있는 경우:

```bash
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

queue.add('CurateTransformJob', {
  corpCode: '00126380',  // 삼성전자
  bsnsYear: '2023',
  reprtCode: '11011',    // 사업보고서
  fsDiv: 'CFS'           // 연결재무제표
});
"
```

### 3. 테스트 스크립트 실행

```bash
# 기본값 (삼성전자 2023 사업보고서 CFS)
npx tsx test-curate.ts

# 커스텀 파라미터
npx tsx test-curate.ts 00126380 2023 11011 CFS
```

**출력 예시**:
```
================================================================================
FMWP Curate Module Test
================================================================================
Corp Code: 00126380
Year: 2023
Report Code: 11011
FS Div: CFS
================================================================================

[1/2] Transforming Raw → Curated...

✅ Transform Result:
  Success: true
  Rows Processed: 523
  Rows Created: 523
  Rows Skipped: 0
  Parse Errors: 0
  Unmapped Rows: 45
  Coverage: 91.40%
  Duration: 2341ms

[2/2] Generating Mapping Coverage Report...

✅ Coverage Report:
  Total Rows: 523
  Mapped: 478
  Unmapped: 45
  Coverage: 91.40%

  By Statement:
    BS: 315/350 (90.0%)
    IS: 142/150 (94.7%)
    CF: 21/23 (91.3%)

  Top Unmapped Accounts:
    [BS] 투자부동산 (12회)
    [BS] 사용권자산 (8회)
    [IS] 종속기업및관계기업관련손익 (5회)
    ...
```

---

## 📊 데이터베이스 확인

### Curated Facts 조회

```sql
-- 특정 기업/연도의 Curated Facts
SELECT
  fiscal_year,
  statement_type,
  account_name_kr,
  standard_line_id,
  amount,
  currency
FROM curated_fin_facts
WHERE corp_code = '00126380'  -- 삼성전자
  AND fiscal_year = 2023
  AND fs_scope = 'CONSOLIDATED'
ORDER BY statement_type, ordering;
```

### 매핑 커버리지 확인

```sql
-- 매핑된 계정 vs 미매핑 계정
SELECT
  statement_type,
  COUNT(*) as total,
  COUNT(standard_line_id) as mapped,
  COUNT(*) - COUNT(standard_line_id) as unmapped,
  ROUND(COUNT(standard_line_id) * 100.0 / COUNT(*), 2) as coverage_pct
FROM curated_fin_facts
WHERE corp_code = '00126380'
  AND fiscal_year = 2023
GROUP BY statement_type;
```

### 미매핑 계정 Top 10

```sql
-- 가장 많이 등장하는 미매핑 계정
SELECT
  account_name_kr,
  statement_type,
  COUNT(*) as count
FROM curated_fin_facts
WHERE standard_line_id IS NULL
GROUP BY account_name_kr, statement_type
ORDER BY count DESC
LIMIT 10;
```

---

## 🔧 매핑 룰 추가

미매핑 계정을 발견하면 새 매핑 룰을 추가할 수 있습니다:

```typescript
import { addMappingRule } from './lib/curate';

await addMappingRule({
  accountNameKr: '^투자부동산$',
  standardLineId: 'BS.OTHER_NCA',
  statementType: 'BS',
  priority: 10,
  confidenceScore: 1.0,
});
```

또는 직접 DB에 추가:

```sql
INSERT INTO curated_fin_account_mapping
  (id, account_name_kr, standard_line_id, statement_type, priority, confidence_score, mapping_version, created_at)
VALUES
  (gen_random_uuid(), '^투자부동산$', 'BS.OTHER_NCA', 'BS', 10, 1.0, 1, NOW());
```

---

## 📈 데이터 품질 모니터링

### Parse Success Rate

```sql
-- 숫자 파싱 실패율 확인
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN amount = 0 THEN 1 END) as zero_values,
  ROUND(COUNT(CASE WHEN amount = 0 THEN 1 END) * 100.0 / COUNT(*), 2) as zero_pct
FROM curated_fin_facts
WHERE corp_code = '00126380'
  AND fiscal_year = 2023;
```

### Coverage by Year

```sql
-- 연도별 매핑 커버리지 추세
SELECT
  fiscal_year,
  COUNT(*) as total_facts,
  COUNT(standard_line_id) as mapped_facts,
  ROUND(COUNT(standard_line_id) * 100.0 / COUNT(*), 2) as coverage_pct
FROM curated_fin_facts
WHERE corp_code = '00126380'
GROUP BY fiscal_year
ORDER BY fiscal_year DESC;
```

---

## 🎯 다음 단계 (Phase 3)

명세서 **Section 5: 3-Statement Modeling Engine** 구현:

1. **Historical Data Populate**
   - Curated Facts → IS/BS/CF Historical 생성
   - Working Capital calculation
   - PP&E roll-forward

2. **Forecast Engine**
   - Revenue drivers (성장률, 가격×물량)
   - Cost drivers (매출 대비 %, 고정+변동)
   - Capex forecast

3. **Cash Flow Generation**
   - Indirect method (BS 변화 기반)
   - NWC 변동 자동 계산
   - Plug mechanism (현금/리볼버)

4. **Model Checks**
   - BS Balance Check (Assets = Liabilities + Equity)
   - CF Tie-out (Ending Cash = Beginning Cash + Net Change)
   - Circularity 해결

---

## 🐛 문제 해결

### "No raw data found" 오류

Raw 데이터가 없으면 Curate를 실행할 수 없습니다. 먼저 수집:

```bash
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

queue.add('FetchFinancialAllJob', {
  corpCode: '00126380',
  bsnsYear: '2023',
  reprtCode: '11011',
  fsDiv: 'CFS'
});
"
```

### "Entity not found" 오류

Entity는 자동 생성되지만, corp_master에 corp_code가 없으면 실패합니다. 먼저 corp_master 동기화:

```bash
node -e "
const { Queue } = require('bullmq');
const { redis } = require('./lib/redis');
const queue = new Queue('fmwp-ingestion', { connection: redis });

queue.add('SyncCorpMasterJob', {});
"
```

### 매핑 커버리지가 낮은 경우

1. `test-curate.ts` 실행하여 Top Unmapped Accounts 확인
2. 새 매핑 룰 추가
3. 캐시 무효화 후 재실행

---

## 📚 관련 파일

- [lib/curate/normalizer.ts](lib/curate/normalizer.ts) - 숫자 파싱, 기간 정규화
- [lib/curate/mapper.ts](lib/curate/mapper.ts) - 계정 매핑 엔진
- [lib/curate/transform.ts](lib/curate/transform.ts) - Raw → Curated 변환
- [worker.ts](worker.ts) - CurateTransformJob 구현
- [test-curate.ts](test-curate.ts) - 테스트 스크립트
- [schema.prisma](schema.prisma) - Curated 스키마 (curated_fin_*)

---

**Phase 2 구현 완료!** 🎉

다음은 Phase 3: 3-Statement Modeling Engine 구현입니다.
