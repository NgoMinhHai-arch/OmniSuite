import { NextResponse } from 'next/server';
import { AppMetrics } from '@/shared/utils/metrics';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const metrics: AppMetrics = await req.json();

    const wb = XLSX.utils.book_new();

    // Mapping for readable names
    const toolNames: Record<string, string> = {
      content: 'Viết bài AI',
      keywords: 'Nghiên cứu Từ khóa',
      images: 'Hình ảnh AI',
      maps: 'Quét bản đồ',
      scraper: 'Máy cào SEO'
    };

    // Sheet 1: Summary
    const summaryData = [
      ['BÁO CÁO HỆ THỐNG OMNISUITE'],
      [`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`],
      [],
      ['THỐNG KÊ SỬ DỤNG CÔNG CỤ'],
      ['Công cụ', 'Lượt sử dụng'],
      ...Object.entries(metrics.tool_usage).map(([k, v]) => [toolNames[k] || k, v]),
      [],
      ['THỐNG KÊ API & SERVICES'],
      ['Nhà cung cấp', 'Số lượt gọi'],
      ...Object.entries(metrics.api_calls).map(([k, v]) => [k, v]),
      [],
      ['TỔNG KẾT'],
      ['Tổng cuộc gọi API', Object.values(metrics.api_calls).reduce((a, b) => a + b, 0)],
      ['Tổng file xuất bản', metrics.files_exported]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Formatting widths
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

    // Sheet 2: History (Nhật ký)
    const historyData = [
      ['Thời gian', 'Công cụ', 'Hành động', 'Trạng thái', 'Mô tả chi tiết'],
      ...metrics.history.map(h => [
        new Date(h.timestamp).toLocaleString('vi-VN'),
        h.tool,
        h.action,
        h.status === 'success' ? 'Thành công' : h.status === 'failed' ? 'Lỗi' : 'Thông tin',
        h.details
      ])
    ];
    const wsHistory = XLSX.utils.aoa_to_sheet(historyData);
    wsHistory['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Nhật ký Hoạt động');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="OmniSuite_Report.xlsx"'
      }
    });

  } catch (error) {
    console.error('Metrics Export Error:', error);
    return NextResponse.json({ error: 'Failed to generate excel' }, { status: 500 });
  }
}
