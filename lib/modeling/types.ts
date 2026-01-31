import { Decimal, DecimalValue } from "@/lib/math";

export type WaccInputs = {
  equity: DecimalValue;
  debt: DecimalValue;
  costOfEquity: DecimalValue;
  costOfDebt: DecimalValue;
  taxRate: DecimalValue;
};

export type WaccResult = {
  wacc: Decimal;
  components: {
    equityWeight: Decimal;
    debtWeight: Decimal;
    costOfEquity: Decimal;
    costOfDebt: Decimal;
    taxRate: Decimal;
  };
};

export type DcfInputs = {
  fcf: DecimalValue[];
  wacc: DecimalValue;
  terminalGrowth?: DecimalValue;
  terminalMultiple?: DecimalValue;
  netDebt?: DecimalValue;
  cash?: DecimalValue;
  sharesOutstanding?: DecimalValue;
};

export type DcfResult = {
  enterpriseValue: Decimal;
  equityValue: Decimal;
  perShareValue: Decimal | null;
  pvFcf: Decimal[];
  terminalValue: Decimal;
  pvTerminalValue: Decimal;
  discountRate: Decimal;
  terminalMethod: "perpetuity" | "multiple";
};
