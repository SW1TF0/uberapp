import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ride, VehicleType } from '../types/models';
import { formatDualCurrency } from '../utils/currency';

const VEHICLE_LABELS: Record<VehicleType, string> = {
  economy: 'KardzhaliGo',
  comfort: 'KardzhaliGo Comfort',
  xl: 'KardzhaliGo XL',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завършено',
  cancelled: 'Отказано',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type ReceiptOptions = {
  // The driver's own copy shows the commission breakdown (what the
  // platform kept, what they actually earned) instead of just the total.
  showEarnings?: boolean;
  driverName?: string;
};

function buildReceiptHtml(ride: Ride, options: ReceiptOptions): string {
  const fareBGN = ride.finalFareBGN ?? ride.fareEstimateBGN;
  const receiptNumber = ride.id.slice(-8).toUpperCase();
  const pickup = escapeHtml(ride.pickup.address || 'Начална точка');
  const dropoff = escapeHtml(ride.dropoff.address || 'Крайна точка');
  const paymentLabel = ride.paymentMethod === 'cash' ? 'В брой' : 'Карта';
  const statusLabel = STATUS_LABELS[ride.status] ?? ride.status;
  const stars = typeof ride.rating === 'number' ? '★'.repeat(ride.rating) + '☆'.repeat(5 - ride.rating) : '';

  const earningsRows =
    options.showEarnings && ride.platformFeeBGN != null && ride.driverEarningsBGN != null
      ? `<tr><td class="label">Такса на платформата (10%)</td><td class="value">−${formatDualCurrency(ride.platformFeeBGN)}</td></tr>
         <tr><td class="label bold">Твой приход</td><td class="value bold">${formatDualCurrency(ride.driverEarningsBGN)}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; padding: 36px; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 24px; }
  .logo {
    width: 56px; height: 56px; border-radius: 28px; background: #A11D2E;
    color: #fff; font-weight: bold; font-size: 22px; line-height: 56px;
    display: inline-block; text-align: center;
  }
  h1 { font-size: 20px; margin: 14px 0 4px; }
  .muted { color: #888; font-size: 13px; }
  .divider { border-top: 1px dashed #ccc; margin: 22px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; font-size: 14px; vertical-align: top; }
  .label { color: #666; }
  .value { text-align: right; }
  .bold { font-weight: 700; }
  .total-row td { font-size: 20px; font-weight: 800; color: #A11D2E; padding-top: 16px; }
  .footer { margin-top: 36px; text-align: center; color: #999; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">K</div>
    <h1>Kardzhali Ride</h1>
    <div class="muted">Касова бележка &middot; №${receiptNumber}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tr><td class="label">Дата</td><td class="value">${formatDateTime(ride.completedAt ?? ride.requestedAt)}</td></tr>
    <tr><td class="label">От</td><td class="value">${pickup}</td></tr>
    <tr><td class="label">До</td><td class="value">${dropoff}</td></tr>
    <tr><td class="label">Разстояние</td><td class="value">${ride.distanceKm} км &middot; ${ride.durationMin} мин</td></tr>
    <tr><td class="label">Клас автомобил</td><td class="value">${VEHICLE_LABELS[ride.vehicleType]}</td></tr>
    ${options.driverName ? `<tr><td class="label">Шофьор</td><td class="value">${escapeHtml(options.driverName)}</td></tr>` : ''}
    <tr><td class="label">Начин на плащане</td><td class="value">${paymentLabel}</td></tr>
    <tr><td class="label">Статус</td><td class="value">${statusLabel}</td></tr>
    ${stars ? `<tr><td class="label">Оценка</td><td class="value">${stars}</td></tr>` : ''}
  </table>

  <div class="divider"></div>

  <table>
    ${earningsRows}
    <tr class="total-row"><td>Общо</td><td class="value">${formatDualCurrency(fareBGN)}</td></tr>
  </table>

  <div class="footer">Благодарим, че пътува с Kardzhali Ride</div>
</body>
</html>`;
}

// Renders the receipt to a local PDF (expo-print, fully on-device, no
// server) and opens the OS share sheet — the standard free way to both
// "send" it (any app: email, messaging, etc.) and "save" it (most share
// sheets offer Save to Files/Drive/Photos directly). Nothing is uploaded
// anywhere; the PDF only exists in the device's temp storage until the
// user saves or sends it somewhere.
export async function shareReceipt(ride: Ride, options: ReceiptOptions = {}): Promise<void> {
  const html = buildReceiptHtml(ride, options);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Споделянето не е налично на това устройство.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Касова бележка · Kardzhali Ride',
    UTI: 'com.adobe.pdf',
  });
}
