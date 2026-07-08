import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesCard from './SeriesCard';
import type { Series } from '../types';

function make(over: Partial<Series> = {}): Series {
  return {
    id: 'a', title: 'Test', originalTitle: '', author: '', link: '',
    lastChapter: 3, rating: 0, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: Date.now(), pinned: false, ...over,
  };
}

const handlers = () => ({
  onIncrement: vi.fn(), onDecrement: vi.fn(), onEdit: vi.fn(),
  onDelete: vi.fn(), onTogglePin: vi.fn(), onRate: vi.fn(),
});

describe('SeriesCard', () => {
  it('fires onIncrement when + is clicked', async () => {
    const h = handlers();
    render(<SeriesCard series={make()} {...h} />);
    await userEvent.click(screen.getByLabelText('Increment chapter'));
    expect(h.onIncrement).toHaveBeenCalledWith('a');
  });

  it('disables decrement at chapter 0', () => {
    const h = handlers();
    render(<SeriesCard series={make({ lastChapter: 0 })} {...h} />);
    expect(screen.getByLabelText('Decrement chapter')).toBeDisabled();
  });

  it('fires onTogglePin from the star', async () => {
    const h = handlers();
    render(<SeriesCard series={make()} {...h} />);
    await userEvent.click(screen.getByLabelText('Pin series'));
    expect(h.onTogglePin).toHaveBeenCalledWith('a');
  });

  it('sets a rating from the star control', async () => {
    const h = handlers();
    render(<SeriesCard series={make({ rating: 0 })} {...h} />);
    await userEvent.click(screen.getByLabelText('Rate 4 stars'));
    expect(h.onRate).toHaveBeenCalledWith('a', 4);
  });

  it('sets a half rating', async () => {
    const h = handlers();
    render(<SeriesCard series={make({ rating: 0 })} {...h} />);
    await userEvent.click(screen.getByLabelText('Rate 2.5 stars'));
    expect(h.onRate).toHaveBeenCalledWith('a', 2.5);
  });
});
