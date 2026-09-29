import type { Metadata } from 'next';
import { OAuthConsentForm } from '@/components/OAuthConsentForm';
import { getOAuthGrant } from '@/lib/dal';

export const metadata: Metadata = {
  title: 'Connect an app',
};

// An AI app (Claude, ChatGPT, …) sent the user here to ask for access to their blog.
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ grant?: string }>;
}) {
  const { grant: grantId } = await searchParams;
  const grant = grantId ? await getOAuthGrant(grantId) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      {grant && grantId ? (
        <OAuthConsentForm grantId={grantId} grant={grant} />
      ) : (
        <>
          <h1 className="text-2xl font-bold">Link expired</h1>
          <p className="mt-4 text-gray-600">
            This connection request is invalid, has expired, or was already answered. Start again
            from your AI app.
          </p>
        </>
      )}
    </main>
  );
}
