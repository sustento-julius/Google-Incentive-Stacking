/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PropertyType = 'noah' | 'nonprofit';

export type IncomeTier = 'low' | 'moderate' | 'high';
// Low: < 80% Area Median Income (AMI) - qualifies for 100% electrification rebates (HEEHRA)
// Moderate: 80% to 120% AMI - qualifies for 50% electrification rebates (HEEHRA)
// High: > 120% AMI - does not qualify for raw HEEHRA rebates

export type UtilityProvider = 'LADWP' | 'SCE' | 'Burbank' | 'Glendale' | 'Pasadena' | 'PG_AND_E' | 'SDG_AND_E';

export interface PropertyConfig {
  type: PropertyType; // 'noah' or 'nonprofit' (Deed-Restricted)
  unitsCount: number; // 5-49 units target
  zipCode: string;
  utility: UtilityProvider;
  incomeTier: IncomeTier;
  hasTaxLiability: boolean;
  isEquityRegion: boolean; // Relevant for California SGIP storage bonus
  isDAC: boolean; // Disadvantaged Community (CalEnviroScreen)
  percentTenantsLMI: number; // Percentage of tenants meeting low-income or poverty thresholds (e.g., 65%, 80%)
}

export type UpgradeCategory =
  | 'heat_pump_hvac'
  | 'heat_pump_water_heater'
  | 'solar_pv'
  | 'battery_storage'
  | 'electrical_panel'
  | 'ev_charger'
  | 'building_envelope';

export interface UpgradeItem {
  id: UpgradeCategory;
  name: string;
  description: string;
  selected: boolean;
  unitCost: number; // For multifamily, this is cost per unit. For SF, total cost.
  quantityMultiplier: number; // E.g., number of heat pumps, kW of solar, or units upgraded
  customCost: number | null; // Null uses default unitCost * multiplier
}

export interface IncentiveSource {
  id: string;
  name: string;
  type: 'federal_tax_credit' | 'federal_rebate' | 'state_rebate' | 'utility_rebate';
  amount: number;
  description: string;
}

export interface UpgradeCalculation {
  id: UpgradeCategory;
  name: string;
  baseCost: number;
  applicableIncentives: IncentiveSource[];
  totalRebates: number; // Direct cash back / upfront discounts
  totalTaxCredits: number; // Claimed on tax return
  ownerNetCost: number;
  estimatedAnnualSavings: number; // Energy bill savings
  estimatedCO2Savings: number; // lbs of CO2 per year
}

export interface TotalSummary {
  grossCost: number;
  totalRebates: number;
  totalCredits: number;
  netCost: number;
  totalAnnualSavings: number;
  totalCO2Savings: number;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  property: PropertyConfig;
  selectedUpgradeIds: UpgradeCategory[];
  itemsState: Record<UpgradeCategory, { unitCost: number; multiplier: number }>;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}
