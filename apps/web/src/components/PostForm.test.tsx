import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostForm } from './PostForm';

describe('PostForm', () => {
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

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: 'My Post', content: 'Post body text.' }));
  });

  it('pre-fills fields from initialValues for editing', () => {
    render(
      <PostForm
        initialValues={{ title: 'Existing', content: 'Existing body', excerpt: '', category: 'Tech' }}
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
});
