import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Force Node.js runtime để Buffer và fs hoạt động đúng
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name = file.name.toLowerCase();

    let text = "";

    if (name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }
    else if (name.endsWith('.pdf')) {
      const mod = (await import('pdf-parse/node')) as unknown as {
        PDFParse?: new (init: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> };
        default?: new (init: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> };
      };
      const Ctor = mod.PDFParse || mod.default;
      if (!Ctor) {
        return NextResponse.json({ error: 'Module pdf-parse không khả dụng.' }, { status: 500 });
      }
      const parser = new Ctor({ data: buffer });
      const result = await parser.getText();
      text = result.text;
    }
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n--- Bảng: ${sheetName} ---\n`;
        text += xlsx.utils.sheet_to_csv(sheet);
      });
    }
    else {
      text = buffer.toString('utf-8');
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("Parse File Error:", err.message || err);
    return NextResponse.json(
      { error: "Lỗi giải mã tệp: " + (err.message || "Lỗi không xác định") },
      { status: 500 }
    );
  }
}
