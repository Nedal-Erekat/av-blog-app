'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type MouseEvent, type ReactNode } from 'react';
import type { Category } from '@/lib/types';

export function CategoryFilterShell({
  categories,
  activeCategory,
  children,
}: {
  categories: Category[];
  activeCategory?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string, e: MouseEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <>
      {categories.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            onClick={(e) => navigate('/', e)}
            className={!activeCategory ? 'font-semibold underline' : 'text-gray-600'}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${category.slug}`}
              onClick={(e) => navigate(`/?category=${category.slug}`, e)}
              className={activeCategory === category.slug ? 'font-semibold underline' : 'text-gray-600'}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
        {children}
      </div>
    </>
  );
}
