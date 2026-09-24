const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = windows.get(identifier);
  if (!current || current.resetAt <= now) {
    windows.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
