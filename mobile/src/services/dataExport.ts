import database from '@react-native-firebase/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ride, UserProfile, DriverRecord } from '../types/models';
import { fetchDriverCompletedRides } from '../utils/reviews';
import { formatDualCurrency } from '../utils/currency';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('bg-BG', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function fetchRiderRides(uid: string): Promise<Ride[]> {
  const historySnapshot = await database().ref(`/riderHistory/${uid}`).once('value');
  if (!historySnapshot.exists()) return [];
  const rideIds: string[] = [];
  historySnapshot.forEach((child) => {
    rideIds.push(child.key as string);
    return undefined;
  });
  const rideSnapshots = await Promise.all(rideIds.map((id) => database().ref(`/rides/${id}`).once('value')));
  const rides: Ride[] = [];
  rideSnapshots.forEach((snap, i) => {
    if (snap.exists()) rides.push({ id: rideIds[i], ...(snap.val() as Omit<Ride, 'id'>) });
  });
  return rides;
}

function rideRow(ride: Ride): string {
  return `<tr>
    <td>${formatDateTime(ride.completedAt ?? ride.requestedAt)}</td>
    <td>${escapeHtml(ride.pickup.address || '—')} → ${escapeHtml(ride.dropoff.address || '—')}</td>
    <td>${ride.distanceKm} км</td>
    <td>${formatDualCurrency(ride.finalFareBGN ?? ride.fareEstimateBGN)}</td>
    <td>${ride.status}</td>
  </tr>`;
}

// GDPR Art. 20 "right to data portability" — everything this account's
// owner can see about themselves in the app, in one downloadable file.
// Rendered as a PDF via expo-print (same free, on-device mechanism as the
// ride receipts) and handed to the OS share sheet so the user can save it
// wherever they like.
export async function exportMyData(uid: string, profile: UserProfile): Promise<void> {
  const rides = profile.role === 'driver' ? await fetchDriverCompletedRides(uid) : await fetchRiderRides(uid);

  let driverSection = '';
  if (profile.role === 'driver') {
    const driverSnap = await database().ref(`/drivers/${uid}`).once('value');
    const driver = driverSnap.val() as DriverRecord | null;
    if (driver) {
      driverSection = `
        <h2>Данни за шофьор</h2>
        <table>
          <tr><td class="label">Кола</td><td>${escapeHtml(
            `${driver.profile?.vehicle?.color ?? ''} ${driver.profile?.vehicle?.make ?? ''} ${driver.profile?.vehicle?.model ?? ''} · ${driver.profile?.vehicle?.plate ?? ''}`
          )}</td></tr>
          <tr><td class="label">Оценка</td><td>${driver.profile?.rating ?? '—'}</td></tr>
          <tr><td class="label">Одобрен</td><td>${driver.approved ? 'Да' : 'Не'}</td></tr>
          ${
            driver.compliance
              ? `<tr><td class="label">Св. за управление №</td><td>${escapeHtml(driver.compliance.licenseNumber)}</td></tr>
                 <tr><td class="label">Застрахователна полица №</td><td>${escapeHtml(driver.compliance.insurancePolicyNumber)}</td></tr>
                 <tr><td class="label">Полица валидна до</td><td>${formatDateTime(driver.compliance.insuranceExpiresAt)}</td></tr>`
              : ''
          }
        </table>`;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1a1a1a; }
  h1 { font-size: 20px; color: #A11D2E; }
  h2 { font-size: 15px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  td, th { padding: 6px 4px; font-size: 11px; text-align: left; border-bottom: 1px solid #eee; }
  th { color: #888; font-weight: 600; }
  .label { color: #666; width: 40%; }
  .muted { color: #888; font-size: 12px; }
</style>
</head>
<body>
  <h1>Kardzhali Ride · Моите данни</h1>
  <p class="muted">Генерирано на ${formatDateTime(Date.now())} · съгласно чл. 20 от Регламент (ЕС) 2016/679 (GDPR)</p>

  <h2>Профил</h2>
  <table>
    <tr><td class="label">Име</td><td>${escapeHtml(profile.name)}</td></tr>
    <tr><td class="label">Телефон</td><td>${escapeHtml(profile.phone)}</td></tr>
    <tr><td class="label">Имейл</td><td>${escapeHtml(profile.email)}</td></tr>
    <tr><td class="label">Роля</td><td>${profile.role === 'driver' ? 'Шофьор' : 'Пътник'}</td></tr>
    <tr><td class="label">Регистриран на</td><td>${formatDateTime(profile.createdAt)}</td></tr>
    ${
      profile.consent
        ? `<tr><td class="label">Съгласие с условията</td><td>${formatDateTime(profile.consent.termsAcceptedAt)} (версия ${escapeHtml(profile.consent.version)})</td></tr>`
        : ''
    }
  </table>

  ${driverSection}

  <h2>История на пътуванията (${rides.length})</h2>
  <table>
    <tr><th>Дата</th><th>Маршрут</th><th>Разстояние</th><th>Цена</th><th>Статус</th></tr>
    ${rides.map(rideRow).join('') || '<tr><td colspan="5" class="muted">Няма пътувания</td></tr>'}
  </table>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Споделянето не е налично на това устройство.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Моите данни · Kardzhali Ride',
    UTI: 'com.adobe.pdf',
  });
}
