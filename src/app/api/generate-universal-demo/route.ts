import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, input, apiKeys, useApiMode } = body;

    if (!mode || !input) {
      return NextResponse.json({ error: "Thiếu dữ liệu: Mode hoặc Input" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'universal_scraper_demo.py');
    
    // Thử thực thi với 'python' trước, nếu không được có thể thử 'py'
    // Sử dụng chuỗi lệnh trực tiếp để tránh lỗi phân tách đối số của shell trên Windows
    const fullCommand = `python "${scriptPath}" "${mode}" "${input}"`;
    
    console.log("Executing:", fullCommand);

    const result = spawnSync(fullCommand, {
      encoding: 'utf-8',
      shell: true,
      env: { 
        ...process.env, 
        PYTHONIOENCODING: 'utf-8',
        USE_API_MODE: useApiMode ? "true" : "false",
        VALUESERP_API_KEY: apiKeys?.valueserp || process.env.VALUESERP_API_KEY,
        HASDATA_API_KEY: apiKeys?.hasdata || process.env.HASDATA_API_KEY
      }
    });

    if (result.error) {
       // Thử dự phòng với lệnh 'py' (Windows Python Launcher)
       const fallbackCommand = `py "${scriptPath}" "${mode}" "${input}"`;
       const fallbackResult = spawnSync(fallbackCommand, {
         encoding: 'utf-8',
         shell: true,
         env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
       });
       
       if (fallbackResult.status === 0) {
          try {
            return NextResponse.json(JSON.parse(fallbackResult.stdout));
          } catch(e) {}
       }
    }

    if (result.status !== 0) {
      return NextResponse.json({ 
        error: "Script Python gặp lỗi khi xử lý.", 
        details: result.stderr || "Vui lòng kiểm tra cài đặt Python (requests, bs4)." 
      }, { status: 500 });
    }

    try {
      const data = JSON.parse(result.stdout);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ 
        error: "Kết quả trả về không đúng định dạng JSON.", 
        raw: result.stdout.slice(0, 500) 
      }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: "Lỗi hệ thống: " + (error.message || "Unknown") }, { status: 500 });
  }
}
