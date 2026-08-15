// Excel export for the Events Calculator — 3 sheets (קלט/תוצאות/סיכום)
// with REAL formulas (not pasted static values), mirroring
// calcEngine.ts's calculateEvent() logic line-for-line, plus a Hebrew
// explanation column. If calculateEvent() ever changes, these formulas
// must be updated to match — there is no automatic sync between the two.
// exceljs is only imported dynamically (inside the functions below) — it's
// a large, rarely-used-per-session dependency, so it's kept out of the
// main bundle and only fetched when an export is actually triggered.
import type ExcelJS from 'exceljs';
import { NICHES } from '@/components/calculator/NicheSelector';
import type { CalcParams } from '@/lib/calcEngine';

const CURRENCY_FMT = '#,##0" ₪"';
const PERCENT_FMT = '0.0"%"';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F6350' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
}

export async function buildCalcWorkbook(params: CalcParams): Promise<ExcelJS.Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const niche = NICHES.find((n) => n.id === params.niche);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ריפוי הרמוני';
  workbook.created = new Date();

  // ---- קלט (Input) ----
  const input = workbook.addWorksheet('קלט', { views: [{ rightToLeft: true }] });
  input.columns = [{ width: 30 }, { width: 20 }];
  input.getCell('A1').value = 'פרמטרי קלט — מחשבון אירועים';
  input.getCell('A1').font = { bold: true, size: 14 };
  input.mergeCells('A1:B1');
  const inputHeader = input.getRow(2);
  inputHeader.getCell(1).value = 'פרמטר';
  inputHeader.getCell(2).value = 'ערך';
  styleHeaderRow(inputHeader);

  const inputRows: [string, string | number | boolean][] = [
    ['סוג פעילות', niche?.label ?? params.niche],
    ['שם לקוח', params.clientName || '—'],
    ['מספר מטפלים', params.therapists],
    ['שעות פעילות', params.hours],
    ['כמות משתתפים', params.participants],
    ['תעריף שעתי (גבייה, ₪)', params.ratePerHour],
    ['שכר מטפל (לדקה, ₪)', params.wagePerMinute],
    ['מרחק נסיעה (ק"מ)', params.travelKm],
    ['עמלת מתחם (%)', params.commissionPct],
    ['מטפל עצמאי (המטפל הוא בעל העסק)', params.isOwnerTreating],
    ['הגעה ברכב אחד (איחוד נסיעות)', params.oneCarArrival ?? false],
    ['שיטת תצוגת שכר (לדקה/לשעה) — לתצוגה בלבד, אינה משפיעה על החישוב', params.wageMode === 'hr' ? 'לפי שעה' : 'לפי דקה'],
    ['הבטחת הכנסה מופעלת', params.incomeGuarantee],
    ['תעריף שעתי מובטח (₪) — לאירועים עד 4 שעות', params.guaranteeMin3h],
  ];
  inputRows.forEach(([label, value], i) => {
    const row = input.getRow(3 + i);
    row.getCell(1).value = label;
    row.getCell(1).alignment = { horizontal: 'right' };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: 'right' };
  });
  // Row indices (1-based) for formula references below — must match inputRows order exactly.
  const IN = {
    therapists: 5,
    hours: 6,
    participants: 7,
    ratePerHour: 8,
    wagePerMinute: 9,
    travelKm: 10,
    commissionPct: 11,
    isOwnerTreating: 12,
    oneCarArrival: 13,
    incomeGuarantee: 15,
    guaranteeMin3h: 16,
  };

  // ---- תוצאות (Results) ----
  const results = workbook.addWorksheet('תוצאות', { views: [{ rightToLeft: true }] });
  results.columns = [{ width: 30 }, { width: 18 }, { width: 55 }];
  results.getCell('A1').value = 'תוצאות חישוב';
  results.getCell('A1').font = { bold: true, size: 14 };
  results.mergeCells('A1:C1');
  const resultsHeader = results.getRow(2);
  resultsHeader.getCell(1).value = 'שדה';
  resultsHeader.getCell(2).value = 'ערך (נוסחה)';
  resultsHeader.getCell(3).value = 'הסבר חישוב';
  styleHeaderRow(resultsHeader);

  // Labels + explanations only here — actual formulas are written in the
  // second pass below, once every field's row number is known (several
  // formulas reference other Results rows, e.g. totalPayroll needs
  // totalWage/totalTravel/guaranteeSupplement's row numbers).
  type ResultRow = { label: string; explain: string; fmt?: string };
  const rows: ResultRow[] = [
    { label: 'סה"כ דקות טיפול', explain: 'מספר מטפלים × שעות פעילות × 60' },
    { label: 'זמן ממוצע לאורח (דקות)', explain: 'סה"כ דקות טיפול ÷ כמות משתתפים (מעוגל למטה)' },
    { label: 'מחזור הכנסות ברוטו', explain: 'מספר מטפלים × שעות פעילות × תעריף שעתי', fmt: CURRENCY_FMT },
    { label: 'עמלת מתחם', explain: 'מחזור הכנסות ברוטו × אחוז עמלה ÷ 100', fmt: CURRENCY_FMT },
    {
      label: 'מטפלים בתשלום',
      explain: 'אם המטפל הוא בעל העסק — מפחית מטפל אחד (חיסכון בשכר), אחרת ללא שינוי',
    },
    {
      label: 'כמות רכבים',
      explain: 'אם "הגעה ברכב אחד" מופעל: 1. אחרת: זהה למטפלים בתשלום.',
    },
    { label: 'שכר שעתי', explain: 'שכר לדקה × 60', fmt: CURRENCY_FMT },
    { label: 'עלות שכר כוללת', explain: 'מטפלים בתשלום × שעות פעילות × שכר שעתי', fmt: CURRENCY_FMT },
    {
      label: 'עלות נסיעות כוללת',
      explain: 'כמות רכבים × (מרחק נסיעה (ק"מ) ÷ 10 × 8 ₪ לליטר) — עלות דלק ישירה בלבד',
      fmt: CURRENCY_FMT,
    },
    {
      label: 'השלמה למטפל בודד',
      explain:
        'אם האירוע פחות מ-4 שעות: (מקסימום 0, תעריף שעתי מובטח - שכר שעתי) × שעות פעילות. ' +
        'אירוע של 4 שעות ומעלה: אין השלמה כלל (0).',
      fmt: CURRENCY_FMT,
    },
    {
      label: 'השלמת שכר כוללת (הבטחת הכנסה)',
      explain: 'פעיל רק אם "הבטחת הכנסה מופעלת" — השלמה למטפל בודד × מטפלים בתשלום',
      fmt: CURRENCY_FMT,
    },
    {
      label: 'סה"כ עלות שכר ונסיעות',
      explain: 'עלות שכר כוללת + עלות נסיעות כוללת + השלמת שכר כוללת',
      fmt: CURRENCY_FMT,
    },
    {
      label: 'רווח נקי',
      explain: 'מחזור הכנסות ברוטו - עמלת מתחם - סה"כ עלות שכר ונסיעות',
      fmt: CURRENCY_FMT,
    },
    {
      label: "אחוז רווחיות (מרג'ין)",
      explain: 'רווח נקי ÷ מחזור הכנסות ברוטו × 100 (0 אם המחזור הוא 0)',
      fmt: PERCENT_FMT,
    },
  ];

  // Write rows first (so we know each field's row number), fixing up
  // formulas that reference other Results rows in a second pass.
  const rowIndex: Record<number, string> = {}; // position in `rows` -> sheet row number
  rows.forEach((row, i) => {
    const sheetRow = 3 + i;
    rowIndex[i] = String(sheetRow);
    results.getCell(`A${sheetRow}`).value = row.label;
    results.getCell(`A${sheetRow}`).alignment = { horizontal: 'right' };
    results.getCell(`C${sheetRow}`).value = row.explain;
    results.getCell(`C${sheetRow}`).alignment = { horizontal: 'right', wrapText: true };
    if (row.fmt) results.getCell(`B${sheetRow}`).numFmt = row.fmt;
    results.getCell(`B${sheetRow}`).alignment = { horizontal: 'right' };
  });

  const totalMinutesRow = rowIndex[0];
  const minPerParticipantRow = rowIndex[1];
  const grossRevenueRow = rowIndex[2];
  const commissionCostRow = rowIndex[3];
  const paidTherapistsRow = rowIndex[4];
  const vehicleCountRow = rowIndex[5];
  const hourlyWageRow = rowIndex[6];
  const totalWageRow = rowIndex[7];
  const totalTravelRow = rowIndex[8];
  const supplementPerTherapistRow = rowIndex[9];
  const guaranteeSupplementRow = rowIndex[10];
  const totalPayrollRow = rowIndex[11];
  const netProfitRow = rowIndex[12];
  const marginRow = rowIndex[13];

  results.getCell(`B${totalMinutesRow}`).value = { formula: `קלט!B${IN.therapists}*קלט!B${IN.hours}*60` };
  results.getCell(`B${minPerParticipantRow}`).value = { formula: `FLOOR(B${totalMinutesRow}/קלט!B${IN.participants},1)` };
  results.getCell(`B${grossRevenueRow}`).value = { formula: `קלט!B${IN.therapists}*קלט!B${IN.hours}*קלט!B${IN.ratePerHour}` };
  results.getCell(`B${commissionCostRow}`).value = { formula: `B${grossRevenueRow}*קלט!B${IN.commissionPct}/100` };
  results.getCell(`B${paidTherapistsRow}`).value = {
    formula: `IF(AND(קלט!B${IN.isOwnerTreating},קלט!B${IN.therapists}>=1),קלט!B${IN.therapists}-1,קלט!B${IN.therapists})`,
  };
  results.getCell(`B${vehicleCountRow}`).value = {
    formula: `IF(קלט!B${IN.oneCarArrival},1,B${paidTherapistsRow})`,
  };
  results.getCell(`B${hourlyWageRow}`).value = { formula: `קלט!B${IN.wagePerMinute}*60` };
  results.getCell(`B${totalWageRow}`).value = { formula: `B${paidTherapistsRow}*קלט!B${IN.hours}*B${hourlyWageRow}` };
  results.getCell(`B${totalTravelRow}`).value = { formula: `B${vehicleCountRow}*(קלט!B${IN.travelKm}/10*8)` };
  // Hourly floor-rate guarantee (business decision): events under 4 hours
  // top up the shortfall between the guaranteed hourly rate and the real
  // hourly wage, for every hour of the event. 4h+ events get no top-up.
  results.getCell(`B${supplementPerTherapistRow}`).value = {
    formula: `IF(קלט!B${IN.hours}<4,MAX(0,קלט!B${IN.guaranteeMin3h}-B${hourlyWageRow})*קלט!B${IN.hours},0)`,
  };
  results.getCell(`B${guaranteeSupplementRow}`).value = {
    formula: `IF(קלט!B${IN.incomeGuarantee},B${supplementPerTherapistRow}*B${paidTherapistsRow},0)`,
  };
  results.getCell(`B${totalPayrollRow}`).value = { formula: `B${totalWageRow}+B${totalTravelRow}+B${guaranteeSupplementRow}` };
  results.getCell(`B${netProfitRow}`).value = { formula: `B${grossRevenueRow}-B${commissionCostRow}-B${totalPayrollRow}` };
  results.getCell(`B${marginRow}`).value = {
    formula: `IF(B${grossRevenueRow}>0,B${netProfitRow}/B${grossRevenueRow}*100,0)`,
  };

  // ---- סיכום (Summary) ----
  const summary = workbook.addWorksheet('סיכום', { views: [{ rightToLeft: true }] });
  summary.columns = [{ width: 30 }, { width: 20 }];
  summary.getCell('A1').value = 'סיכום';
  summary.getCell('A1').font = { bold: true, size: 14 };
  summary.mergeCells('A1:B1');
  const summaryHeader = summary.getRow(2);
  summaryHeader.getCell(1).value = 'שדה';
  summaryHeader.getCell(2).value = 'ערך';
  styleHeaderRow(summaryHeader);

  const summaryRows: [string, string, string?][] = [
    ['מחזור הכנסות ברוטו', `=תוצאות!B${grossRevenueRow}`, CURRENCY_FMT],
    ['עמלת מתחם', `=תוצאות!B${commissionCostRow}`, CURRENCY_FMT],
    ['סה"כ עלות שכר ונסיעות', `=תוצאות!B${totalPayrollRow}`, CURRENCY_FMT],
    ['רווח נקי', `=תוצאות!B${netProfitRow}`, CURRENCY_FMT],
    ['אחוז רווחיות', `=תוצאות!B${marginRow}`, PERCENT_FMT],
  ];
  summaryRows.forEach(([label, formula, fmt], i) => {
    const sheetRow = 3 + i;
    summary.getCell(`A${sheetRow}`).value = label;
    summary.getCell(`A${sheetRow}`).alignment = { horizontal: 'right' };
    summary.getCell(`B${sheetRow}`).value = { formula: formula.slice(1) };
    summary.getCell(`B${sheetRow}`).alignment = { horizontal: 'right' };
    if (fmt) summary.getCell(`B${sheetRow}`).numFmt = fmt;
  });

  return workbook;
}

export async function downloadCalcWorkbook(params: CalcParams): Promise<void> {
  const workbook = await buildCalcWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `מחשבון-אירועים-${params.clientName || 'ללא-שם'}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
