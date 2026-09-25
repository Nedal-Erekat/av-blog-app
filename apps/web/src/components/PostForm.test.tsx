import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostForm } from './PostForm';
import { ApiError, apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: jest.fn() },
}));

describe('PostForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a validation error and does not call onSubmit when required fields are empty', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<PostForm submitLabel="Publish" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the parsed input when the form is valid', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PostForm submitLabel="Publish" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Title'), 'My Post');
    await user.type(screen.getByLabelText('Content'), 'Post body text.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'My Post', content: 'Post body text.' }),
    );
  });

  it('pre-fills fields from initialValues for editing', () => {
    render(
      <PostForm
        initialValues={{
          title: 'Existing',
          content: 'Existing body',
          excerpt: '',
          category: 'Tech',
        }}
        submitLabel="Save changes"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Existing');
    expect(screen.getByLabelText('Content')).toHaveValue('Existing body');
    expect(screen.getByLabelText('Category (optional)')).toHaveValue('Tech');
  });

  it('shows a generic error message when onSubmit rejects with a non-API error', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('network died'));
    const user = userEvent.setup();
    render(<PostForm submitLabel="Publish" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Title'), 'My Post');
    await user.type(screen.getByLabelText('Content'), 'Post body text.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  describe('AI suggestions', () => {
    const content = 'A long enough post body about shipping our blog with Docker.';

    it('fills excerpt and category from the AI suggestion', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        suggestion: { excerpt: 'How we shipped with Docker.', category: 'Engineering' },
      });
      const user = userEvent.setup();
      render(<PostForm submitLabel="Publish" onSubmit={jest.fn()} />);

      await user.type(screen.getByLabelText('Title'), 'Docker');
      await user.type(screen.getByLabelText('Content'), content);
      await user.click(screen.getByRole('button', { name: /suggest/i }));

      expect(apiClient.post).toHaveBeenCalledWith('/api/ai/summarize', {
        title: 'Docker',
        content,
      });
      await waitFor(() =>
        expect(screen.getByLabelText('Excerpt (optional)')).toHaveValue(
          'How we shipped with Docker.',
        ),
      );
      expect(screen.getByLabelText('Category (optional)')).toHaveValue('Engineering');
    });

    it('does not call the API when there is too little content', async () => {
      const user = userEvent.setup();
      render(<PostForm submitLabel="Publish" onSubmit={jest.fn()} />);

      await user.type(screen.getByLabelText('Title'), 'Docker');
      await user.type(screen.getByLabelText('Content'), 'Too short');
      await user.click(screen.getByRole('button', { name: /suggest/i }));

      expect(apiClient.post).not.toHaveBeenCalled();
      expect(await screen.findByText(/write a bit more content/i)).toBeInTheDocument();
    });

    it('shows the API error when the AI is unavailable', async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(
        new ApiError('The AI assistant is unavailable right now.', 503),
      );
      const user = userEvent.setup();
      render(<PostForm submitLabel="Publish" onSubmit={jest.fn()} />);

      await user.type(screen.getByLabelText('Title'), 'Docker');
      await user.type(screen.getByLabelText('Content'), content);
      await user.click(screen.getByRole('button', { name: /suggest/i }));

      expect(
        await screen.findByText('The AI assistant is unavailable right now.'),
      ).toBeInTheDocument();
    });
  });
});
