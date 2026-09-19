import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {App} from './app';

describe('App', () => {
  it('should render the page title', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {name: /Program Capacity & Invoice Reservation/i}),
    ).toBeInTheDocument();
  });

  it('should link to the health endpoint and both documentation views of the api', () => {
    render(<App />);

    const targets = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/health'),
        expect.stringContaining('/docs'),
        expect.stringContaining('/redoc'),
      ]),
    );
  });
});
