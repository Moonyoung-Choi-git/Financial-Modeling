/**
 * Timeline Builder
 * Creates Period Index timeline (명세서 Section 5.1)
 */

import { Period, ModelTimeline } from './model-types';

/**
 * Build timeline for model
 *
 * @param baseYear - 기준 연도 (보통 가장 최근 연도)
 * @param historicalYears - Historical 기간 수 (예: 5 → 5년 과거)
 * @param forecastYears - Forecast 기간 수 (예: 5 → 5년 미래)
 * @param periodType - ANNUAL or QUARTER
 */
export function buildTimeline(params: {
  baseYear: number;
  historicalYears: number;
  forecastYears: number;
  periodType: 'ANNUAL' | 'QUARTER';
}): ModelTimeline {
  const { baseYear, historicalYears, forecastYears, periodType } = params;

  const periods: Period[] = [];
  let periodIndex = 0;

  if (periodType === 'ANNUAL') {
    // Annual periods
    // Historical: baseYear-4, baseYear-3, baseYear-2, baseYear-1, baseYear
    // Forecast: baseYear+1, baseYear+2, ..., baseYear+forecastYears

    // Historical periods (negative to 0)
    for (let i = historicalYears - 1; i >= 0; i--) {
      const year = baseYear - i;
      const index = historicalYears - 1 - i; // 0부터 시작

      periods.push({
        index,
        fiscalYear: year,
        fiscalQuarter: null,
        periodType: 'ANNUAL',
        isHistorical: true,
        label: `FY${year}`,
      });
    }

    // Forecast periods
    for (let i = 1; i <= forecastYears; i++) {
      const year = baseYear + i;
      const index = historicalYears - 1 + i;

      periods.push({
        index,
        fiscalYear: year,
        fiscalQuarter: null,
        periodType: 'ANNUAL',
        isHistorical: false,
        label: `FY${year}E`, // E = Estimate
      });
    }
  } else {
    // Quarterly periods (MVP에서는 미지원, 향후 구현)
    throw new Error('Quarterly periods not yet supported in MVP');
  }

  return {
    periods,
    historicalCount: historicalYears,
    forecastCount: forecastYears,
    baseYear,
  };
}

/**
 * Get period by index
 */
export function getPeriodByIndex(timeline: ModelTimeline, index: number): Period | null {
  return timeline.periods.find((p) => p.index === index) || null;
}

/**
 * Get period by fiscal year
 */
export function getPeriodByYear(
  timeline: ModelTimeline,
  fiscalYear: number
): Period | null {
  return timeline.periods.find((p) => p.fiscalYear === fiscalYear) || null;
}

/**
 * Get all historical periods
 */
export function getHistoricalPeriods(timeline: ModelTimeline): Period[] {
  return timeline.periods.filter((p) => p.isHistorical);
}

/**
 * Get all forecast periods
 */
export function getForecastPeriods(timeline: ModelTimeline): Period[] {
  return timeline.periods.filter((p) => !p.isHistorical);
}

/**
 * Get period range
 */
export function getPeriodRange(timeline: ModelTimeline): {
  minYear: number;
  maxYear: number;
  minIndex: number;
  maxIndex: number;
} {
  const years = timeline.periods.map((p) => p.fiscalYear);
  const indices = timeline.periods.map((p) => p.index);

  return {
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
    minIndex: Math.min(...indices),
    maxIndex: Math.max(...indices),
  };
}

/**
 * Format period label
 */
export function formatPeriodLabel(period: Period): string {
  if (period.periodType === 'ANNUAL') {
    return period.isHistorical ? `FY${period.fiscalYear}` : `FY${period.fiscalYear}E`;
  } else {
    return period.isHistorical
      ? `Q${period.fiscalQuarter} ${period.fiscalYear}`
      : `Q${period.fiscalQuarter} ${period.fiscalYear}E`;
  }
}
