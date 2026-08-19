const DELAY_MS = 1500;

export async function throttle(): Promise<void> {
  await new Promise((r) => setTimeout(r, DELAY_MS));
}