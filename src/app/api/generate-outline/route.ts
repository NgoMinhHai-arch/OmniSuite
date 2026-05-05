import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { getAIModel } from '@/shared/lib/ai-provider';
import { fetchTavilyContext } from '@/shared/utils/tavily';

export const maxDuration = 60;

const frameworkPrompts: Record<string, string> = {
  'Tự do': `Không ràng buộc cấu trúc. AI tự quyết bố cục phù hợp nhất với chủ đề.`,

  'AIDA': `Mở đầu bằng câu gây chú ý mạnh → tạo sự thích thú bằng thông tin thú vị → khơi gợi mong muốn sở hữu/hành động → kết bằng CTA rõ ràng.`,

  'PAS': `Nêu vấn đề người đọc đang gặp → khuếch đại nỗi đau, hậu quả nếu không giải quyết → đưa ra giải pháp cụ thể.`,

  'Blog Post': `Intro nêu vấn đề → thân bài H2/H3 rõ ràng → kết luận tóm tắt + CTA.`,

  'Kim tự tháp ngược': `Câu đầu tiên phải là câu trả lời/kết luận trực tiếp. Không mở đầu chung chung. Thông tin quan trọng nhất lên đầu, chi tiết bổ sung xuống dưới. Không lặp thông tin giữa các section.`,

  'Pillar Post': `Bài dài 2000+ từ bao phủ toàn bộ chủ đề. Có mục lục, nhiều H2 chính, mỗi H2 có 2-3 H3. Liên kết nội bộ đến các bài con liên quan.`,

  'How-to (Từng bước)': `Bắt đầu bằng kết quả đạt được sau khi làm theo. Chia thành các bước đánh số rõ ràng. Mỗi bước có: tên bước + giải thích + lý do tại sao.`,

  'Listicle (Top N)': `Title dạng "Top N..." hoặc "N cách...". Mỗi item có tiêu đề + giải thích 2-3 câu. Sắp xếp từ quan trọng nhất xuống hoặc logic tăng dần.`,

  'Review sản phẩm': `Tổng quan nhanh → thông số kỹ thuật → ưu điểm thực tế → nhược điểm thực tế → so sánh đối thủ → verdict rõ ràng → CTA.`,

  'So sánh (X vs Y)': `Giới thiệu 2 đối tượng → bảng so sánh tiêu chí → phân tích từng tiêu chí → kết luận nên chọn cái nào trong trường hợp nào.`,

  'FAQ': `Danh sách câu hỏi thực tế người dùng hay hỏi. Mỗi câu trả lời ngắn gọn, trực tiếp, dưới 150 từ.`,

  'Skyscraper': `Phân tích điểm mạnh của bài đang rank top → viết bài đầy đủ hơn, mới hơn, có thêm ví dụ thực tế và data cụ thể mà bài gốc thiếu.`,

  'Storytelling': `Mở đầu bằng câu chuyện thật hoặc tình huống cụ thể → dẫn dắt tự nhiên đến vấn đề → giải pháp → bài học rút ra.`,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      topic,
      keyword, 
      secondaryKeywords,
      masterContext, 
      sampleArticle, 
      demand, 
      framework = 'Tự do', 
      provider, 
      modelName, 
      apiKey, 
      customBaseUrl,
      tavilyApiKey
    } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const model = getAIModel(provider, apiKey, modelName, customBaseUrl);
    
    // FETCH TAVILY CONTEXT (RAG)
    let tavilyContext = "";
    if (tavilyApiKey) {
      tavilyContext = await fetchTavilyContext(keyword, tavilyApiKey);
      console.log("--- TAVILY CONTEXT FOR OUTLINE ---");
      console.log(tavilyContext);
      console.log("----------------------------------");
    }

    const frameworkInstruction = frameworkPrompts[framework] || frameworkPrompts['Tự do'];

    const systemPrompt = `Bạn là một chuyên gia SEO Copywriter. Bạn CHỈ GIAO TIẾP VÀ VIẾT BẰNG TIẾNG VIỆT 100%. Nhiệm vụ của bạn là tạo dàn ý dựa trên tập dữ liệu CONTEXT thực tế dưới đây để đảm bảo thông tin chính xác nhất.
+ ƯU TIÊN: Sử dụng data từ CONTEXT.
+ NẾU CONTEXT THIẾU: Hãy sử dụng kiến thức chuyên môn của bạn để bổ sung các ý cần thiết cho một bài viết chuẩn SEO, đảm bảo không bịa đặt số liệu.

## CONTEXT DỮ LIÊU THỰC TẾ (TAVILY) (CHỈ THAM KHẢO, NẾU LÀ TIẾNG NƯỚC NGOÀI, BẠN PHẢI DỊCH SANG TIẾNG VIỆT):
${tavilyContext || "Không có dữ liệu."}

## DỮ LIỆU ĐẦU VÀO:
${masterContext ? masterContext : 'Dùng kiến thức chuyên môn về chủ đề này.'}
`;

    const userPrompt = `
Tạo dàn ý bài viết CHUẨN SEO cho:
- **Chủ đề**: "${topic || keyword}"
- **Từ khóa chính (Focus)**: "${keyword}"
- **Từ khóa phụ (LSI)**: "${secondaryKeywords || "Tự động gợi ý"}"

## LUẬT BẮT BUỘC:
- Viết dàn ý hoàn toàn bằng tiếng Việt
- Không lặp thông tin giữa các section
- Không dùng ký tự ngôn ngữ khác 

## CẤU TRÚC BẮT BUỘC:

### FORMAT:
- Dùng ## cho H2 chính
- Dùng ### cho H3 phụ (2-4 H3 mỗi H2)
- Mỗi H3 có mô tả ngắn 1 dòng về nội dung

### SỐ LƯỢNG:
- Tối thiểu 4-6 H2
- Mỗi H2 có 2-4 H3
- Tổng: 12-20 H3

### SEO REQUIREMENTS:
- Tiêu đề H2 PHẢI chứa từ khóa chính hoặc từ khóa phụ một cách tự nhiên.
- H3 phải có nội dung độc đáo, khai thác sâu các khía cạnh của "${topic || keyword}".

## FRAMEWORK: ${framework.toUpperCase()}
${frameworkInstruction}

## OUTPUT MẪU:
\`\`\`markdown
## H2: Tiêu đề chứa keyword cho H2 này

### H3: Điểm 1 - mô tả ngắn
### H3: Điểm 2 - mô tả ngắn
### H3: Điểm 3 - mô tả ngắn

## H2: Tiêu đề H2 tiếp theo

### H3: Điểm 1 - mô tả ngắn
### H3: Điểm 2 - mô tả ngắn
\`\`\`

${sampleArticle ? `## BÀI MẪU:\n${sampleArticle}` : ''}
${demand ? `## YÊU CẦU: ${demand}` : ''}

CHỈ trả về dàn ý markdown. Tuyệt đối không viết nội dung chi tiết. CHỈ VIẾT DÀN Ý BẰNG TIẾNG VIỆT!`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxRetries: 0,
      maxOutputTokens: 1000
    });

    return NextResponse.json({ 
      outline: result.text,
      tavilyContext: tavilyContext 
    });
  } catch (error: any) {
    console.error("Outline Gen Error:", error.message || error);
    let msg = error.message || "Lỗi tạo dàn ý";
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("exceeded")) {
      msg = "API Key của bạn đã đạt giới hạn sử dụng. Vui lòng dùng Key khác hoặc đổi Model nhẹ hơn.";
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
