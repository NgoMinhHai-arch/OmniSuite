import Link from 'next/link';
import { redirect } from 'next/navigation';
import { findTool, REQUIREMENTS } from '@/lib/seo/tool-registry';

type Props = {
  params: Promise<{ slug: string[] }>;
};

const KEYWORD_TOOL_SLUGS = new Set([
  'bulk-keyword-tagger',
  'category-keyword-finder',
  'dataforseo-suggestions',
  'ebay-related-searches',
  'keyword-deduplication',
  'keyword-difficulty-checker',
  'keyword-grouper',
  'keyword-to-questions',
  'keyword-topic-classifier',
  'keyword-trends-analyzer',
  'keywords-everywhere',
  'micro-moments-classifier',
  'paa-scraper',
  'related-searches-tree',
  'serp-keyword-extractor',
  'topical-map-generator',
  'keyword-consolidation-suggester',
  'keyword-to-page',
]);

const KNOWN_TOOL_DESTINATIONS: Record<string, string> = {
  'keyword-analyzer': '/dashboard/keywords',
};

export default async function SeoToolsSlugFallbackPage({ params }: Props) {
  const { slug } = await params;
  const rawSlug = slug?.length ? slug.join('/') : '';
  const toolSlug = rawSlug.split('/').filter(Boolean).pop() || '';

  if (!toolSlug) {
    redirect('/dashboard/seo-tools');
  }

  if (KNOWN_TOOL_DESTINATIONS[toolSlug]) {
    redirect(KNOWN_TOOL_DESTINATIONS[toolSlug]);
  }

  const tool = findTool(toolSlug);

  if (tool?.category === 'keywords' || KEYWORD_TOOL_SLUGS.has(toolSlug)) {
    redirect(`/dashboard/keywords?from=${encodeURIComponent(toolSlug)}`);
  }

  const reqs = tool?.requires || [];

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-500/25 p-6 md:p-8" style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="mb-4 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
          Công cụ chưa có màn hình chạy riêng
        </div>

        <h1 className="text-2xl font-black">
          {tool?.title || `SEO tool: ${toolSlug}`}
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          {tool?.description || 'Công cụ này có trong danh sách nhưng chưa có phần giao diện và API chạy thật trong mã nguồn hiện tại.'}
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 p-4" style={{ backgroundColor: 'var(--hover-bg)' }}>
          <div className="text-sm font-bold text-amber-300">Vì sao bấm vào tưởng như không hoạt động?</div>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Kho mã hiện có metadata cho công cụ này, nhưng chưa có trang triển khai tương ứng trong thư mục
            <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5">src/app/dashboard/seo-tools/{toolSlug}</code>.
            Trang này được thêm để báo rõ trạng thái thay vì chuyển vòng về trang danh sách rồi làm người dùng nghi ngờ thực tại.
          </p>
        </div>

        {reqs.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-black">Yêu cầu cấu hình</div>
            <div className="flex flex-wrap gap-2">
              {reqs.map((req) => (
                <span key={req} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                  {REQUIREMENTS[req]?.label || req}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard/seo-tools" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/5">
            Quay lại bộ công cụ
          </Link>
          <Link href="/dashboard/keywords" className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500">
            Mở phân tích từ khóa thật
          </Link>
          <Link href="/dashboard/settings" className="rounded-xl border border-cyan-500/25 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10">
            Kiểm tra khóa API
          </Link>
        </div>
      </div>
    </div>
  );
}
