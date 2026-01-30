'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils'; 
import IncomeStatementTable from '@/components/income-statement-table';
import BalanceSheetTable from '@/components/balance-sheet-table';
import CashFlowTable from '@/components/cash-flow-table';

interface ViewProps {
  data: any;
  years: number[];
}

type StatementType = 'IS' | 'BS' | 'CF';

export default function FinancialStatementsView({ data, years }: ViewProps) {
  const [activeTab, setActiveTab] = useState<StatementType>('IS');

  return (
    <div className="w-full bg-white rounded-lg border shadow-sm">
      {/* 탭 네비게이션 */}
      <div className="flex border-b">
        {(['IS', 'BS', 'CF'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors outline-none",
              activeTab === tab 
                ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50/50" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            {tab === 'IS' ? 'Income Statement' : 
             tab === 'BS' ? 'Balance Sheet' : 'Cash Flow'}
          </button>
        ))}
      </div>

      {activeTab === 'IS' && <IncomeStatementTable data={data} years={years} />}
      {activeTab === 'BS' && <BalanceSheetTable data={data} years={years} />}
      {activeTab === 'CF' && <CashFlowTable data={data} years={years} />}
    </div>
  );
}
