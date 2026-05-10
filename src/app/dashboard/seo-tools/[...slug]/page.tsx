import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string[] }>;
};

export default async function SeoToolsSlugFallbackPage({ params }: Props) {
  const { slug } = await params;
  const target = slug?.length
    ? `/dashboard/seo-tools?tool=${encodeURIComponent(slug.join('/'))}`
    : '/dashboard/seo-tools';
  redirect(target);
}

