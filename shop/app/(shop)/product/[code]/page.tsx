import Image from "next/image";
import Link from "next/link";
import { getProductByCode, getCategories } from "@/lib/catalog";
import { notFound } from "next/navigation";
import AddToBasketButton from "@/components/AddToBasketButton";

export function generateStaticParams() {
  const params: { code: string }[] = [];
  for (const cat of getCategories()) {
    for (const prod of cat.products) {
      params.push({ code: prod.baseCode });
    }
  }
  return params;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = getProductByCode(decodeURIComponent(code));

  if (!result) notFound();

  const { product, category } = result;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/" className="hover:text-persimmon-green transition">
          All Categories
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link
          href={`/category/${category.slug}`}
          className="hover:text-persimmon-green transition"
        >
          {category.name}
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-300">{product.baseCode}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center justify-center aspect-square">
          {product.image ? (
            <div className="flex flex-col items-center gap-3">
              <Image
                src={product.image}
                alt={product.name}
                width={400}
                height={400}
                className="object-contain max-h-full"
                priority
              />
              <p className="text-[11px] text-gray-300 text-center">Preview image — final artwork will be professionally produced to order</p>
            </div>
          ) : (
            <div className="text-gray-200 flex flex-col items-center gap-3">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-300">No image available</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-persimmon-green font-semibold tracking-wide uppercase mb-2">
            {product.baseCode}
          </p>
          <h1 className="text-2xl font-bold text-persimmon-navy mb-6 leading-tight">
            {product.name}
          </h1>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {product.variants.length > 1
                ? "Available Sizes"
                : "Product Details"}
            </h2>

            {product.variants.map((variant) => (
              <div
                key={variant.code}
                className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 hover:border-gray-200 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{variant.code}</p>
                    {variant.size && (
                      <p className="text-sm text-gray-400 mt-0.5">{variant.size}</p>
                    )}
                    {variant.material && (
                      <p className="text-xs text-gray-300 mt-0.5">{variant.material}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-persimmon-navy">
                      {"\u00A3"}{variant.price.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">ex. VAT</p>
                  </div>
                </div>

                <AddToBasketButton product={product} variant={variant} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
