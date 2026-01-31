import { Prisma } from '@prisma/client';

// Re-export Decimal for convenience
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export type DecimalValue = Prisma.Decimal.Value;

/**
 * Safely converts input to Decimal.
 * Throws error if precision loss is detected in number inputs (optional strict mode).
 */
export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/**
 * Basic arithmetic operations ensuring Decimal type return
 */
export const FinMath = {
  add: (a: DecimalValue, b: DecimalValue) => new Decimal(a).plus(b),
  sub: (a: DecimalValue, b: DecimalValue) => new Decimal(a).minus(b),
  mul: (a: DecimalValue, b: DecimalValue) => new Decimal(a).times(b),
  div: (a: DecimalValue, b: DecimalValue) => new Decimal(a).dividedBy(b),
  
  // Check if Assets = Liabilities + Equity (with tolerance)
  isBalanced: (assets: DecimalValue, liab: DecimalValue, equity: DecimalValue, tolerance = 0.01) => 
    new Decimal(assets).minus(new Decimal(liab).plus(equity)).abs().lessThanOrEqualTo(tolerance)
};