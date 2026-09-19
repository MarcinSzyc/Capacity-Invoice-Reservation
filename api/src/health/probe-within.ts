/**
 * Readiness must answer, even when a dependency does not. A TCP connect to a database that
 * dropped off the network, or a broker inside the client's retry loop, can hang far longer than
 * a load balancer is willing to wait, which would turn "503 until both answer" into no answer at
 * all. A probe that has not spoken within the bound counts as unreachable.
 */
export const probeWithin = async (
  timeoutMs: number,
  probe: () => Promise<boolean>,
): Promise<boolean> => {
  let expire: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    expire = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([probe(), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(expire);
  }
};
