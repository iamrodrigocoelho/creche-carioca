import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StaticModeNotice } from './StaticModeNotice';

/**
 * O componente so aparece no build estatico, entao o modo e forcado por mock do
 * modulo de configuracao — a variavel real e substituida em tempo de build.
 */
vi.mock('@/lib/config', () => ({ STATIC_MODE: true, API_URL: '', DEMO_PROCESS_ID: 'DEMO-2026' }));

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
});

describe('StaticModeNotice', () => {
  it('avisa que os dados ficam no dispositivo', () => {
    render(<StaticModeNotice />);
    expect(screen.getByText(/apenas neste dispositivo/i)).toBeDefined();
    expect(screen.getByText(/não há servidor nem banco de dados/i)).toBeDefined();
  });

  it('apaga o que a demonstracao guardou', async () => {
    globalThis.localStorage.setItem('match-perfeito:static:v1', '{"a":1}');
    const user = userEvent.setup();

    render(<StaticModeNotice />);
    await user.click(screen.getByRole('button', { name: /apagar os dados/i }));

    expect(globalThis.localStorage.getItem('match-perfeito:static:v1')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/dados apagados/i);
  });
});
