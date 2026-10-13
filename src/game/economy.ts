import type { FlightResult } from './flight';

export interface Records {
  distance: number;
  altitude: number;
  speed: number;
  airtime: number;
}

export const EMPTY_RECORDS: Records = { distance: 0, altitude: 0, speed: 0, airtime: 0 };

export interface EarningLine {
  label: string;
  detail: string;
  amount: number;
}

export interface Earnings {
  lines: EarningLine[];
  total: number;
  newRecords: (keyof Records)[];
}

const RATE = { distance: 0.5, altitude: 0.35, speed: 1.2, airtime: 2 };
const RECORD_BONUS = 0.5;

export function computeEarnings(r: FlightResult, best: Records): Earnings {
  const lines: EarningLine[] = [
    { label: 'Distance', detail: `${Math.round(r.distance)} m`, amount: Math.round(r.distance * RATE.distance) },
    { label: 'Max height', detail: `${Math.round(r.maxAltitude)} m`, amount: Math.round(r.maxAltitude * RATE.altitude) },
    { label: 'Top speed', detail: `${Math.round(r.maxSpeed * 3.6)} km/h`, amount: Math.round(r.maxSpeed * RATE.speed) },
    { label: 'Air time', detail: `${r.airtime.toFixed(1)} s`, amount: Math.round(r.airtime * RATE.airtime) },
    { label: 'Coins', detail: `× ${r.coinCount}`, amount: Math.round(r.coinMoney) },
  ];
  const newRecords: (keyof Records)[] = [];
  if (r.distance > best.distance) {
    newRecords.push('distance');
    const amount = Math.round((r.distance - best.distance) * RECORD_BONUS);
    if (amount > 0) lines.push({ label: 'New record!', detail: 'distance bonus', amount });
  }
  if (r.maxAltitude > best.altitude) newRecords.push('altitude');
  if (r.maxSpeed > best.speed) newRecords.push('speed');
  if (r.airtime > best.airtime) newRecords.push('airtime');
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, newRecords };
}

export function updateRecords(best: Records, r: FlightResult): Records {
  return {
    distance: Math.max(best.distance, r.distance),
    altitude: Math.max(best.altitude, r.maxAltitude),
    speed: Math.max(best.speed, r.maxSpeed),
    airtime: Math.max(best.airtime, r.airtime),
  };
}
