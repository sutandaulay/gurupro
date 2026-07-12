import Link from "next/link";
import Image from "next/image";
import { getPosts, getCategories } from "@/lib/payload";

export const revalidate = 60;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const categorySlug = typeof sp.kategori === "string" ? sp.kategori : undefined;

  const [postsData, categories] = await Promise.all([
    getPosts({ category: categorySlug, limit: 50 }),
    getCategories(),
  ]);

  const posts = postsData.docs as any[];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-primary-900 to-slate-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Blog GuruPRO AI</h1>
          <p className="mt-3 text-slate-300 text-sm md:text-base max-w-xl">
            Tips, trik, dan informasi seputar administrasi guru, teknologi pendidikan, dan fitur terbaru GuruPRO AI.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href="/blog"
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              !categorySlug
                ? "bg-primary-600 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            Semua
          </Link>
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/blog?kategori=${cat.slug || cat.id}`}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                categorySlug === (cat.slug || cat.id)
                  ? "bg-primary-600 text-white shadow-md"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {cat.title}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-semibold">Belum ada artikel</p>
            <p className="text-sm mt-1">Artikel akan segera hadir. Pantau terus!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug || post.id}`}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition duration-200"
              >
                <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
                  {post.featuredImage && typeof post.featuredImage === "object" && post.featuredImage.url ? (
                    <Image
                      src={post.featuredImage.url}
                      alt={post.featuredImage.alt || post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">
                      📝
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {post.category && typeof post.category === "object" && (
                    <span className="inline-block px-2.5 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-full mb-2">
                      {post.category.title}
                    </span>
                  )}
                  <h3 className="font-black text-sm text-slate-900 group-hover:text-primary-600 transition line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-semibold">
                    {post.author && <span>{post.author}</span>}
                    {post.publishedDate && (
                      <span>
                        {new Date(post.publishedDate).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
