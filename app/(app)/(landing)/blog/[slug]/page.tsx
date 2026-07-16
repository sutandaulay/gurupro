import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/blog-queries";

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = await getBlogPosts({ limit: 100 });
  return posts.map((post) => ({ slug: post.slug || String(post.id) }));
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-primary-900 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-primary-300 hover:text-white text-xs font-bold transition mb-4"
          >
            ← Kembali ke Blog
          </Link>
          {post.category && typeof post.category === "object" && (
            <span className="inline-block px-3 py-1 bg-primary-500/20 text-primary-300 border border-primary-500/30 text-[10px] font-bold rounded-full mb-3">
              {post.category.title}
            </span>
          )}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-300">
            {post.author && (
              <span className="font-semibold">{post.author}</span>
            )}
            {post.publishedDate && (
              <time>
                {new Date(post.publishedDate).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
        </div>
      </div>

      {post.featuredImage && typeof post.featuredImage === "object" && post.featuredImage.url && (
        <div className="max-w-4xl mx-auto px-6 -mt-10 mb-10 relative z-10">
          <div className="aspect-[2/1] relative rounded-2xl overflow-hidden shadow-xl">
            <Image
              src={post.featuredImage.url}
              alt={post.featuredImage.alt || post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}

      <article className="max-w-3xl mx-auto px-6 pb-20">
        {post.excerpt && (
          <p className="text-lg text-slate-500 font-medium leading-relaxed mb-8 border-l-4 border-primary-500 pl-4 italic">
            {post.excerpt}
          </p>
        )}
        <div className="blog-content max-w-none">
          {post.content && <RichText data={post.content} />}
        </div>
      </article>
    </div>
  );
}
