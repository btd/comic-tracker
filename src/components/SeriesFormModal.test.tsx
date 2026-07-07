import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesFormModal from './SeriesFormModal';

describe('SeriesFormModal', () => {
  it('requires a title', async () => {
    const onSave = vi.fn();
    render(<SeriesFormModal initial={null} onSave={onSave} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('saves a trimmed title with pinned defaulting to false', async () => {
    const onSave = vi.fn();
    render(<SeriesFormModal initial={null} onSave={onSave} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Title*'), '  Berserk  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.title).toBe('Berserk');
    expect(saved.pinned).toBe(false);
  });
});
