import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { getAIModel } from '@/shared/lib/ai-provider';
import { fetchTavilyContext } from '@/shared/utils/tavily';

export const maxDuration = 60;

const frameworkStyleHints: Record<string, string> = {
  'Tự do': 'Viết súc tích, đi thẳng vào vấn đề, không lặp lại định nghĩa.',
  'AIDA': 'Flow: Chú ý (ngắn) → Thích thú (sâu) → Mong muốn (thuyết phục) → Hành động (mạnh).',
  'PAS': 'Flow: Vấn đề (đánh trúng) → Khuếch đại (vừa đủ) → Giải pháp (triệt để).',
  'Blog Post': 'Mở bài (cuốn hút) → Thân bài (chia nhỏ H3, súc tích) → Kết bài (CTA).',
  'Kim tự tháp ngược': 'Thông tin quan trọng nhất ở 2 câu đầu tiên. Không lan man dông dài.',
  'Pillar Post': 'Chuyên sâu, bao quát nhưng không thừa thãi. Mỗi H3 là một giá trị mới.',
  'How-to (Từng bước)': 'Hướng dẫn ngắn gọn, dễ hiểu, không giải thích những điều hiển nhiên.',
  'Listicle (Top N)': 'Mỗi mục tập trung vào ưu điểm nổi bật nhất. Không viết lể mể.',
  'Review sản phẩm': 'Khách quan, tin cậy. Dùng gạch đầu dòng cho ưu/nhược điểm.',
  'So sánh (X vs Y)': 'So sánh trực diện các thông số/tính năng. Không đứng trung lập quá lâu.',
  'FAQ': 'Hỏi ngắn - Đáp thẳng. Không giải thích lòng vòng.',
  'Skyscraper': 'Vượt trội về chất lượng thông tin, không phải số lượng từ ngữ.',
  'Storytelling': 'Kể chuyện cô đọng, có cao trào, dẫn dắt vào giải pháp nhanh chóng.',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      topic,
      keyword,
      secondaryKeywords,
      sectionTitle,
      sectionIndex,
      totalSections,
      masterContext, 
      framework = 'Tự do',
      provider, 
      modelName, 
      apiKey, 
      customBaseUrl,
      tavilyApiKey,
      tavilyContext: providedTavilyContext
    } = body;

    if (!sectionTitle) {
      return NextResponse.json({ error: "Section title is required" }, { status: 400 });
    }

    const model = getAIModel(provider, apiKey, modelName, customBaseUrl);
    
    // FETCH TAVILY CONTEXT (RAG) - Only if not provided by client
    let tavilyContext = providedTavilyContext || "";
    
    if (!tavilyContext && tavilyApiKey) {
      tavilyContext = await fetchTavilyContext(keyword, tavilyApiKey);
      console.log(`--- TAVILY CONTEXT FETCHED FOR SECTION: ${sectionTitle} ---`);
      console.log(tavilyContext);
      console.log("----------------------------------");
    } else if (tavilyContext) {
      console.log(`--- USING PROVIDED TAVILY CONTEXT FOR SECTION: ${sectionTitle} ---`);
    }

    const styleHint = frameworkStyleHints[framework] || frameworkStyleHints['Tự do'];
    const isFirstSection = sectionIndex === 0;
    const isLastSection = sectionIndex === totalSections - 1;

    const systemPrompt = `Bạn là một chuyên gia SEO Copywriter người Việt Nam bậc thầy. 
TUYỆT ĐỐI TUÂN THỦ CÁC QUY TẮC "BÀN TAY SẮT" SAU (VI PHẠM SẼ LÀM HỎNG HỆ THỐNG):
1. **100% TIẾNG VIỆT THUẦN TÚY**: Không được chèn bất kỳ từ nào thuộc ngôn ngữ khác (Anh, Thái, Nhật, Hàn, Trung, v.v.). Ngay cả các từ chuyên ngành nếu có từ tương đương tiếng Việt thì PHẢI dùng tiếng Việt. KHÔNG lạm dụng thuật ngữ nước ngoài.
2. **CẤM LẶP LẠI (ANTI-REPETITION)**: Tuyệt đối không viết lại các câu đã có ý tương xứng ở phần trước. Mỗi đoạn văn phải mang lại giá trị mới.
3. **KHÔNG LAN MAN (DIRECT-TO-POINT)**: Bỏ qua mọi câu chào hỏi, dẫn dắt sáo rỗng như "Như chúng ta đã biết", "Trong thời đại ngày nay". Hãy bắt đầu bằng thông tin hữu ích ngay từ câu đầu tiên.
4. **VĂN PHONG CHUYÊN GIA**: Sử dụng ngôn từ sắc sảo, chuyên nghiệp, súc tích. Tránh dùng các từ ngữ thừa thãi, rườm rà.
5. **DỰA VÀO DỮ LIỆU THỰC TẾ**: Sử dụng tối đa thông tin từ CONTEXT THAM KHẢO để bài viết có chiều sâu kỹ thuật. KHÔNG bịa đặt thông tin sai sự thật.
6. **CHỈ VIẾT ĐỀ MỤC ĐƯỢC GIAO**: Bạn đang viết cho một SECTION cụ thể, không phải toàn bài.

## CONTEXT THAM KHẢO (PHẢI DỊCH SANG TIẾNG VIỆT NẾU LÀ TIẾNG NƯỚC NGOÀI):
${tavilyContext || "Sử dụng kiến thức chuyên gia của bạn."}

## DỮ LIỆU SẢN PHẨM/DỊCH VỤ:
${masterContext || "Không có"}
`;

    const userPrompt = `
HÃY VIẾT NỘI DUNG CHO ĐỀ MỤC: "${sectionTitle}"

YÊU CẦU CHI TIẾT:
- **Chủ đề tổng thể**: "${topic || keyword}"
- **Từ khóa chính (CẦN TỐI ƯU)**: "${keyword}"
- **Từ khóa phụ (CẦN LỒNG GHÉP)**: "${secondaryKeywords || "Không"}"
- **Phong cách**: ${styleHint}
- **Vị trí**: ${sectionIndex + 1}/${totalSections} (${isFirstSection ? 'MỞ ĐẦU' : isLastSection ? 'KẾT LUẬN' : 'THÂN BÀI'})

ĐỊNH DẠNG ĐẦU RA (MANDATORY):
\`\`\`markdown
## ${sectionTitle.replace(/^#+\s*/, '')}

(Nội dung các đoạn văn tiếng Việt 100% ở đây. Súc tích, không lặp lại ý, không dùng ngôn ngữ lạ)
\`\`\`

LƯU Ý CUỐI CÙNG: Nếu bài viết có xuất hiện bất kỳ ký tự tiếng Thái, Nhật, Hàn hoặc English bồi, bạn sẽ thất bại. Hãy chứng minh trình độ Copywriter bậc thầy của mình.
`;

    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxOutputTokens: 1000
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Section Gen Error:", error.message || error);
    let msg = error.message || "Lỗi tạo phần viết";
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit")) {
      msg = "API Key đã đạt giới hạn. Vui lòng dùng Key khác.";
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
