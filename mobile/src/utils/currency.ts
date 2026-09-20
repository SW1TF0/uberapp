// Bulgaria's lev has been pegged to the euro at a fixed rate since 1997
// (via the currency board arrangement, later carried into ERM II) — this
// is not a fluctuating market rate, so a hardcoded constant is accurate
// rather than a simplification. 1 EUR = 1.95583 BGN.
export const BGN_PER_EUR = 1.95583;

export function bgnToEur(bgn: number): number {
  return bgn / BGN_PER_EUR;
}

// "5.36 лв · 2.74 €"
export function formatDualCurrency(bgn: number): string {
  return `${bgn.toFixed(2)} лв · ${bgnToEur(bgn).toFixed(2)} €`;
}

export function formatEur(bgn: number): string {
  return `${bgnToEur(bgn).toFixed(2)} €`;
}
