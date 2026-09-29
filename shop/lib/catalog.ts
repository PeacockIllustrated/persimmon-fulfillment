import catalogData from "@/data/catalog.json";

export interface Variant {
  code: string;
  size: string | null;
  material: string | null;
  description: string;
  price: number;
  persimmonPrice: number;
  sizeSuffix: string | null;
}

export interface CustomField {
  label: string;
  key: string;
  /** When set, the field is a dropdown limited to these values. */
  options?: string[];
}

export interface Product {
  baseCode: string;
  name: string;
  image: string | null;
  variants: Variant[];
  customFields?: CustomField[];
}

export interface Category {
  name: string;
  slug: string;
  description: string;
  products: Product[];
  productCount: number;
}

export interface Catalog {
  categories: Category[];
  totalProducts: number;
  totalVariants: number;
}

export function getCatalog(): Catalog {
  return catalogData as Catalog;
}

export function getCategories(): Category[] {
  return getCatalog().categories;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return getCategories().find((c) => c.slug === slug);
}

export function getProductByCode(code: string): { product: Product; category: Category } | undefined {
  for (const category of getCategories()) {
    const product = category.products.find((p) => p.baseCode === code);
    if (product) return { product, category };
  }
  return undefined;
}

export function searchProducts(query: string): { product: Product; category: Category }[] {
  const q = query.toLowerCase();
  const results: { product: Product; category: Category }[] = [];

  for (const category of getCategories()) {
    for (const product of category.products) {
      if (
        product.baseCode.toLowerCase().includes(q) ||
        product.name.toLowerCase().includes(q) ||
        product.variants.some((v) => v.description.toLowerCase().includes(q) || v.code.toLowerCase().includes(q))
      ) {
        results.push({ product, category });
      }
    }
  }

  return results;
}
