'use client';

import { useEffect, useState } from 'react';

import type { HealthResponse } from '@eggturtle/shared';

type ViewState = {
  loading: boolean;
  health?: HealthResponse;
  error?: string;
};

export default function HomePage() {
  const [state, setState] = useState<ViewState>({ loading: true });

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = (await response.json()) as HealthResponse;
        setState({ loading: false, health: json });
      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    void loadHealth();
  }, []);

  return (
    <main>
      <h1>Eggturtle Node.js Rebuild</h1>
      <p>This is the new Next.js + NestJS skeleton running alongside the legacy stack.</p>
      <section className="card">
        <h2>Health</h2>
        {state.loading ? <p>Loading...</p> : null}
        {state.health ? <pre>{JSON.stringify(state.health, null, 2)}</pre> : null}
        {state.error ? <p>Unable to load health: {state.error}</p> : null}
      </section>
    </main>
  );
}
