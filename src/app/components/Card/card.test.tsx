import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from './card';
import { describe, it, expect } from 'vitest';

describe('Card Component', () => {
  it('renders nested children layout correctly', () => {
    render(
      <Card>
        <span data-testid="card-child">Nested Content</span>
      </Card>
    );

    const content = screen.getByTestId('card-child');
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent('Nested Content');
  });
});
