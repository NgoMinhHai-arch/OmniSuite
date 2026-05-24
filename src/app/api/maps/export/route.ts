import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';

export async function POST(req: Request) {
  try {
    const { results, keyword } = await req.json();

    if (!results || !results.length) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }

    const headers = [
      'Rank',
      'Name',
      'Category',
      'Website',
      'Web & Social Links',
      'Email',
      'Phone',
      'Address',
      'Is Ad',
      'Rating',
      'Reviews',
      'Google Maps Link',
    ];

    const rows = results.map((r: any) => [
      r.rank ?? '',
      r.name ?? '',
      r.category || '',
      r.url_web || '',
      Array.isArray(r.web_sources) ? r.web_sources.join('\n') : '',
      r.email || '',
      r.phone || '',
      r.address || '',
      r.is_ad ? 'Co QC' : '',
      r.rating ?? '',
      r.reviews ?? '',
      r.url_map || '',
    ]);

    const wb = XLSX.utils.book_new();
    const metaRows = [
      ['OMNISUITE AI - GOOGLE MAPS EXPORT'],
      [`Keyword: ${keyword || 'N/A'}`],
      [`Exported At: ${new Date().toLocaleString('vi-VN')}`],
      [''],
      headers,
    ];

    const ws = XLSX.utils.aoa_to_sheet(metaRows.concat(rows));

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws['!freeze'] = { xSplit: 0, ySplit: 5 };
    ws['!autofilter'] = { ref: `A5:L${rows.length + 5}` };

    ws['!cols'] = [
      { wch: 6 },
      { wch: 35 },
      { wch: 46 },
      { wch: 25 },
      { wch: 30 },
      { wch: 30 },
      { wch: 15 },
      { wch: 45 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 50 },
    ];

    const titleStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: '4F46E5' } },
    };

    const metaStyle = {
      font: { bold: true, color: { rgb: '1E293B' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0EA5E9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } },
      },
    };

    const bodyBorder = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };

    ws['A1'].s = titleStyle;
    ws['A2'].s = metaStyle;
    ws['A3'].s = metaStyle;

    for (let c = 0; c < headers.length; c++) {
      const cell = XLSX.utils.encode_cell({ r: 4, c });
      if (ws[cell]) ws[cell].s = headerStyle;
    }

    for (let r = 5; r < rows.length + 5; r++) {
      const isOdd = (r - 5) % 2 === 0;
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          border: bodyBorder,
          fill: { fgColor: { rgb: isOdd ? 'F8FAFC' : 'EEF2FF' } },
          alignment: {
            vertical: 'center',
            horizontal: c === 0 || c === 8 || c === 9 || c === 10 ? 'center' : 'left',
            wrapText: true,
          },
          font: { color: { rgb: '0F172A' } },
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Results');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const fileName = `OmniSuite_Maps_${(keyword || 'results').replace(/[^a-z0-9]/gi, '_')}_${timestamp}.xlsx`;

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('Export Error:', error.message);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
