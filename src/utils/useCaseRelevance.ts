import type { UseCaseOption } from '../types';

type UC = UseCaseOption;

const TARIFF_RELATED: UC[] = [
  'Demand charge reduction',
  'Peak shaving',
  'Power trading/arbitrage',
  'Time shifting for solar PV',
  'EV charging optimization',
];

const DIESEL_RELATED: UC[] = [
  'Diesel replacement',
  'Backup/reliability',
];

const SOLAR_RELATED: UC[] = [
  'Time shifting for solar PV',
  'Carbon reduction target',
];

const BACKUP_RELATED: UC[] = [
  'Backup/reliability',
];

const OPEN_ACCESS_RELATED: UC[] = [
  'Open access optimization',
  'Power trading/arbitrage',
];

function has(selected: UC[], group: UC[]): boolean {
  return selected.some((uc) => group.includes(uc));
}

export function wantsTariffDetails(selected: UC[]): boolean {
  return has(selected, TARIFF_RELATED);
}

export function wantsDiesel(selected: UC[]): boolean {
  return has(selected, DIESEL_RELATED);
}

export function wantsSolar(selected: UC[]): boolean {
  return has(selected, SOLAR_RELATED);
}

export function wantsBackup(selected: UC[]): boolean {
  return has(selected, BACKUP_RELATED);
}

export function wantsOpenAccess(selected: UC[]): boolean {
  return has(selected, OPEN_ACCESS_RELATED);
}
