'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';

function TitleContent({ title }: { title: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={`inline-flex items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
      {title}
      {pending && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      )}
    </span>
  );
}

export function PostTitleLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="text-xl font-semibold hover:underline">
      <TitleContent title={title} />
    </Link>
  );
}
