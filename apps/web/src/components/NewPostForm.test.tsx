import { act, render, screen } from '@testing-library/react';
import { NewPostForm } from './NewPostForm';
import { savePendingDraft } from '@/lib/pending-draft';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('@/lib/actions', () => ({ revalidatePostsList: jest.fn() }));

const draft = { title: 'From the command bar', content: 'Drafted by AI.', category: 'Culture' };

beforeEach(() => {
  sessionStorage.clear();
});

describe('NewPostForm pending drafts', () => {
  it('pre-fills the form with a draft handed over before the page opened', () => {
    sessionStorage.setItem('av-blog:pending-draft', JSON.stringify(draft));

    render(<NewPostForm />);

    expect(screen.getByLabelText('Title')).toHaveValue('From the command bar');
    expect(screen.getByLabelText('Content')).toHaveValue('Drafted by AI.');
    expect(screen.getByLabelText('Category (optional)')).toHaveValue('Culture');
    // Used once, then forgotten, so a refresh doesn't bring it back.
    expect(sessionStorage.getItem('av-blog:pending-draft')).toBeNull();
  });

  it('picks up a draft that arrives while the editor is already open', () => {
    render(<NewPostForm />);
    expect(screen.getByLabelText('Title')).toHaveValue('');

    act(() => savePendingDraft(draft));

    expect(screen.getByLabelText('Title')).toHaveValue('From the command bar');
  });

  it('ignores a malformed draft instead of trusting it', () => {
    sessionStorage.setItem('av-blog:pending-draft', JSON.stringify({ title: '' }));

    render(<NewPostForm />);

    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('pre-fills the form with a draft handed over by an MCP app (server-side)', () => {
    render(<NewPostForm initialDraft={draft} />);

    expect(screen.getByLabelText('Title')).toHaveValue('From the command bar');
    expect(screen.getByLabelText('Category (optional)')).toHaveValue('Culture');
  });
});
