import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { getAIModel } from '@/shared/lib/ai-provider';

export const maxDuration = 120;

const frameworkStyleHints: Record<string, string> = {
  'Tự do': 'Viết tự do, linh hoạt theo cấu trúc logic.',
  'AIDA': 'Viết theo flow: gây chú ý → tạo thích thú → khơi gợi mong muốn → kêu gọi hành động. Văn phong mạnh mẽ, thuyết phục.',
  'PAS': 'Viết theo flow: nêu vấn đề → khuếch đại nỗi đau → đưa giải pháp. Cảm xúc mạnh, gây sự đồng cảm.',
  'Blog Post': 'Viết blog chuẩn: mở bài hấp dẫn → thân bài chi tiết → kết bài có CTA.',
  'Kim tự tháp ngược': 'Đặt thông tin quan trọng nhất ở đầu. Đáp án ngay, chi tiết sau. Phù hợp đọc nhanh.',
  'Pillar Post': 'Viết bài siêu dài 3000-5000 từ, chi tiết nhất có thể, bao phủ toàn bộ chủ đề. Có mục lục rõ ràng.',
  'How-to (Từng bước)': 'Hướng dẫn từng bước rõ ràng, đánh số thứ tự. Mỗi bước cần giải thích chi tiết, có tips nếu cần.',
  'Listicle (Top N)': 'Mỗi item trình bày ngắn gọn nhưng đầy đủ ý. Dùng bullet points, icon. Cuối mỗi item có điểm mấu chốt.',
  'Review sản phẩm': 'Trung lập, khách quan. Ưu/nhược điểm rõ ràng. Có so sánh với đối thủ. Verdict cuối rõ ràng.',
  'So sánh (X vs Y)': 'Đặt 2 bên cạnh nhau, so sánh theo tiêu chí. Kết luận nên chọn ai/phương án nào.',
  'FAQ': 'Câu hỏi ngắn gọn, trả lời đi thẳng vào vấn đề. Dùng list, không cần mở bài/kết bài.',
  'Skyscraper': 'Viết BÀI TỐT HƠN bài đang rank top. Dài hơn, đầy đủ hơn, data mới hơn. Có thông tin bài top chưa có.',
  'Storytelling': 'Mở đầu bằng câu chuyện, có nhân vật, có xung đột, có giải pháp. Rút ra bài học/giải pháp từ câu chuyện.',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      keyword,
      outline,
      masterContext, 
      sampleArticle, 
      demand, 
      framework = 'Tự do',
      provider, 
      modelName, 
      apiKey, 
      customBaseUrl 
    } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const model = getAIModel(provider, apiKey, modelName, customBaseUrl);
    const styleHint = frameworkStyleHints[framework] || frameworkStyleHints['Tự do'];

    const prompt = `Bạn là Chuyên gia viết lách SEO cao cấp. Hãy viết bài viết HOÀN CHỈNH dựa trên dàn ý.

## TỪ KHÓA CHÍNH: "${keyword}"
## FRAMEWORK: ${framework.toUpperCase()}
## PHONG CÁCH: ${styleHint}

## DÀN Ý BÀI VIẾT:
${outline || 'Không có dàn ý cụ thể, viết tự do theo chủ đề.'}

## DỮ LIỆU ĐẦU VÀO (KHAI THÁC TỐI ĐA):
${masterContext ? masterContext : 'Không có dữ liệu cụ thể, dùng kiến thức chuyên môn của bạn.'}

## YÊU CẦU BẮT BUỘC:
1. VIẾT ĐẦY ĐỦ TẤT CẢ CÁC MỤC trong dàn ý. Không bỏ qua bất kỳ mục nào.
2. Dựa 100% vào DỮ LIỆU ĐẦU VÀO. Không bịa đặt số liệu, sự kiện.
3. Văn phong: Chuyên nghiệp, thực dụng, sắc bén. Tránh văn AI.
4. Định dạng: Markdown chuẩn (## H2, ### H3, **bold**, list, table nếu cần).
5. Độ dài: Mỗi mục H2 viết ít nhất 200-300 từ. Tổng bài: 1000-2000+ từ.
6. SEO: Dùng từ khóa tự nhiên trong tiêu đề, H2, H3, body.

${sampleArticle ? `## BÀI MẪU (Bắt chước văn phong):\n${sampleArticle}` : ''}
${demand ? `## YÊU CẦU RIÊNG: ${demand}` : ''}

BẮT ĐẦU VIẾT BÀI:`;

    const result = await streamText({
      model,
      prompt,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Article Gen Error:", error.message || error);
    let msg = error.message || "Lỗi tạo bài viết";
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("exceeded")) {
      msg = "API Key đã đạt giới hạn. Vui lòng dùng Key khác hoặc đổi Model nhẹ hơn.";
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
