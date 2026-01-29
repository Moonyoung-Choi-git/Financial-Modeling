import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Standard Taxonomy Seed (Basic 3-Statement Structure)
  const taxonomyData = [
    // Balance Sheet
    { accountCode: 'BS_1000', accountName: 'Total Assets', statementType: 'BS', isRequired: true },
    { accountCode: 'BS_1100', accountName: 'Current Assets', statementType: 'BS', parentCode: 'BS_1000', isRequired: false },
    { accountCode: 'BS_1200', accountName: 'Non-Current Assets', statementType: 'BS', parentCode: 'BS_1000', isRequired: false },
    { accountCode: 'BS_2000', accountName: 'Total Liabilities', statementType: 'BS', isRequired: true },
    { accountCode: 'BS_3000', accountName: 'Total Equity', statementType: 'BS', isRequired: true },
    
    // Income Statement
    { accountCode: 'IS_1000', accountName: 'Revenue', statementType: 'IS', isRequired: true },
    { accountCode: 'IS_2000', accountName: 'Operating Income', statementType: 'IS', isRequired: true },
    { accountCode: 'IS_3000', accountName: 'Net Income', statementType: 'IS', isRequired: true },
    
    // Cash Flow
    { accountCode: 'CF_1000', accountName: 'CFO', statementType: 'CF', isRequired: true },
    { accountCode: 'CF_2000', accountName: 'CFI', statementType: 'CF', isRequired: true },
    { accountCode: 'CF_3000', accountName: 'CFF', statementType: 'CF', isRequired: true },
  ];

  for (const item of taxonomyData) {
    await prisma.standardTaxonomy.upsert({
      where: { accountCode: item.accountCode },
      update: {},
      create: item,
    });
  }

  console.log(`Seeded ${taxonomyData.length} taxonomy items.`);

  // 2. Account Mapping Rules Seed (OpenDART Regex Patterns)
  console.log('Seeding mapping rules...');
  const mappingRules = [
    // Assets
    { provider: 'OPENDART', pattern: '^자산총계$', code: 'BS_1000' },
    { provider: 'OPENDART', pattern: '^유동자산$', code: 'BS_1100' },
    { provider: 'OPENDART', pattern: '^비유동자산$', code: 'BS_1200' },
    
    // Liabilities & Equity
    { provider: 'OPENDART', pattern: '^부채총계$', code: 'BS_2000' },
    { provider: 'OPENDART', pattern: '^자본총계$', code: 'BS_3000' },

    // Income Statement
    { provider: 'OPENDART', pattern: '^매출액$', code: 'IS_1000' },
    { provider: 'OPENDART', pattern: '^수익\\(매출액\\)$', code: 'IS_1000' }, // 포괄손익계산서 대응
    { provider: 'OPENDART', pattern: '^영업이익$', code: 'IS_2000' },
    { provider: 'OPENDART', pattern: '^영업이익\\(손실\\)$', code: 'IS_2000' },
    { provider: 'OPENDART', pattern: '^당기순이익$', code: 'IS_3000' },
    { provider: 'OPENDART', pattern: '^당기순이익\\(손실\\)$', code: 'IS_3000' },
  ];

  for (const rule of mappingRules) {
    await prisma.accountMappingRule.create({
      data: {
        provider: rule.provider,
        reportedAccountNamePattern: rule.pattern,
        standardAccountCode: rule.code,
        priority: 10, // 기본 우선순위
      }
    });
  }
  
  console.log(`Seeded ${mappingRules.length} mapping rules.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });