import { NextResponse } from 'next/server';
import { marked } from 'marked';
// @ts-ignore
import HTMLtoDOCX from 'html-to-docx';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { markdown, title } = await req.json();

    if (!markdown) {
      return NextResponse.json({ error: "Không có nội dung bài viết" }, { status: 400 });
    }

    // Markdown → HTML
    const html = await marked(markdown);

    // Đóng gói HTML chuẩn với style cơ bản
    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title || 'Bài viết'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.8; }
    h1 { font-size: 20pt; font-weight: bold; }
    h2 { font-size: 16pt; font-weight: bold; margin-top: 20px; }
    h3 { font-size: 14pt; font-weight: bold; }
    p { margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    code { background-color: #f5f5f5; padding: 2px 4px; font-family: Consolas; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

    // HTML → DOCX binary buffer
    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      header: false,
      pageNumber: false,
    });

    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + "_" + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const subject = (title || 'bai-viet').replace(/[\s\/\\?%*:|"<>]+/g, '-');
    const finalFileName = `Xuat file_${subject}_OmniSuite AI_${timestamp}`;
    const encodedFileName = encodeURIComponent(finalFileName);

    return new Response(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodedFileName}.docx"; filename*=UTF-8''${encodedFileName}.docx`,
      },
    });
  } catch (err: any) {
    console.error("Export DOCX Error:", err.message || err);
    return NextResponse.json(
      { error: "Lỗi xuất file DOCX: " + (err.message || "Lỗi không xác định") },
      { status: 500 }
    );
  }
}
