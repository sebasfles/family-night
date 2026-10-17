import type { HealthResponse } from '@family-night/shared';

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`health answered ${String(response.status)}`);
  return (await response.json()) as HealthResponse;
}
