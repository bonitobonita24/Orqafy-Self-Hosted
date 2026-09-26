// Pure helper: resolve `promise`, or `null` once `ms` elapses / the promise
// rejects. Used for best-effort GPS at capture time — a slow or failed fix must
// never block the photo (expo-location's getCurrentPositionAsync has no timeout).

export async function resolveWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise.catch(() => null), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
