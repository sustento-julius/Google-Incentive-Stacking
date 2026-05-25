/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PropertyConfig, UpgradeCategory, UpgradeCalculation, IncentiveSource, TotalSummary } from './types';

export const DEFAULT_UPGRADES: Record<UpgradeCategory, { name: string; description: string; unitCost: number; defaultMultiplier: number }> = {
  heat_pump_hvac: {
    name: 'Heat Pump HVAC',
    description: 'Highly efficient electric split systems for heating & cooling, replacing central boilers or legacy Wall ACs.',
    unitCost: 11000,
    defaultMultiplier: 12, // Default to a 12-unit naturally occurring or nonprofit building
  },
  heat_pump_water_heater: {
    name: 'Heat Pump Water Heater',
    description: 'Central heat pump water heaters, utilizing ambient air heat. Delivers 3-4x more efficiency than old gas boiler stacks.',
    unitCost: 4500,
    defaultMultiplier: 12, // One heater block per unit (or equivalent thermal scale)
  },
  solar_pv: {
    name: 'Rooftop Solar PV (via VNEM)',
    description: 'Solar panels paired with Virtual Net Energy Metering (VNEM) to credit low-income tenants directly on their bills.',
    unitCost: 3500, // Per kW
    defaultMultiplier: 30, // 30 kW standard commercial/multifamily array
  },
  battery_storage: {
    name: 'Resilient Battery Energy Storage',
    description: 'Lithium battery bank integrated with solar, protecting residents during grid strain & mitigating peak charge periods.',
    unitCost: 950, // Per kWh capacity
    defaultMultiplier: 20, // 20 kWh default battery pack
  },
  electrical_panel: {
    name: 'Electrical Service & Panel upgrade',
    description: 'Main switchgear upgrades (120A to 200A+) to support heavy electrical demand of HVAC and EV charger stacking.',
    unitCost: 4500,
    defaultMultiplier: 1, // Single central panel or electrical room overhaul
  },
  ev_charger: {
    name: 'Level 2 EV Smart Chargers',
    description: 'Convenient shared multi-unit EV smart charging ports, essential for modern multifamily tenant retention.',
    unitCost: 1200,
    defaultMultiplier: 4, // 4 shared parking ports
  },
  building_envelope: {
    name: 'Insulation, Sealing & Envelope',
    description: 'Comprehensive duct sealing, attic/crawlspace batts, and low-E draft-proofing to isolate thermal drafts.',
    unitCost: 3000,
    defaultMultiplier: 1, // Base building audit and upgrade
  },
};

export const UTILITY_LABELS: Record<string, string> = {
  LADWP: 'LADWP (Los Angeles Dept of Water & Power)',
  SCE: 'SCE (Southern California Edison)',
  Burbank: 'Burbank Water & Power (BWP)',
  Glendale: 'Glendale Water & Power (GWP)',
  Pasadena: 'Pasadena Water & Power (PWP)',
  PG_AND_E: 'Pacific Gas & Electric (PG&E)',
  SDG_AND_E: 'San Diego Gas & Electric (SDG&E)',
};

/**
 * Perform all incentive stacking calculations dynamically, focusing on the unique program layers
 * highlighted in the Los Angeles Naturally Occurring Affordable Housing (NOAH) & Non-profit MF Retrofit schedules.
 */
export function calculateIncentives(
  property: PropertyConfig,
  selectedUpgrades: Record<UpgradeCategory, { selected: boolean; unitCost: number; multiplier: number }>
): UpgradeCalculation[] {
  const calculations: UpgradeCalculation[] = [];
  const { type, unitsCount, utility, incomeTier, hasTaxLiability, isEquityRegion, isDAC, percentTenantsLMI } = property;

  // Maximum caps for federal programs
  const maxHeehraLimit = 14000 * unitsCount;
  let consumedHeehraRebateSum = 0;

  // Track combined 25C tax caps (applied at a per-unit taxonomy)
  let comfortCreditClaimed = 0;
  let envelopeCreditClaimed = 0;

  const isLMI = incomeTier === 'low' || incomeTier === 'moderate' || percentTenantsLMI >= 60;

  // Pre-sort categories for priority-based HEEHRA claims (similar to first stack iteration)
  const categories: UpgradeCategory[] = [
    'heat_pump_hvac',
    'heat_pump_water_heater',
    'solar_pv',
    'battery_storage',
    'electrical_panel',
    'ev_charger',
    'building_envelope',
  ];

  const sortedCategories = [...categories].sort((a, b) => {
    const priority = {
      heat_pump_hvac: 1,
      heat_pump_water_heater: 2,
      electrical_panel: 3,
      building_envelope: 4,
      solar_pv: 5,
      battery_storage: 6,
      ev_charger: 7,
    };
    return (priority[a] || 99) - (priority[b] || 99);
  });

  const rawResults: Record<UpgradeCategory, Partial<UpgradeCalculation>> = {} as any;

  for (const catId of sortedCategories) {
    const customState = selectedUpgrades[catId];
    if (!customState || !customState.selected) {
      rawResults[catId] = {
        baseCost: 0,
        applicableIncentives: [],
        totalRebates: 0,
        totalTaxCredits: 0,
        ownerNetCost: 0,
      };
      continue;
    }

    const multiplier = customState.multiplier;
    const baseCost = customState.unitCost * multiplier;
    const incentives: IncentiveSource[] = [];

    let totalCategoryRebates = 0;
    let totalCategoryTaxCredits = 0;

    // A. UTILITY REBATES LAYER (LADWP, SCE, POUs) & THEIR ACCESSIBLE MULTIFAMILY STACKS
    let utilityAmount = 0;
    let utilityDesc = '';
    let programName = 'Local Utility Program';

    if (utility === 'LADWP') {
      // LADWP CAMR (Clean Business & Multifamily Program) - Covers 40-50% for qualified affordable buildings
      const qualifiesForCAMR = isDAC || percentTenantsLMI >= 66;

      if (qualifiesForCAMR && ['heat_pump_hvac', 'heat_pump_water_heater', 'building_envelope', 'solar_pv'].includes(catId)) {
        programName = 'LADWP CAMR Program';
        utilityAmount = baseCost * 0.45; // 45% coverage average
        utilityDesc = `LADWP Clean Business & Multifamily (CAMR) Retrofit Incentive covering 45% of total physical installation cost [AEA Administered]`;
      } else {
        // Fall back to standard LADWP Consumer Rebates
        programName = 'LADWP Consumer Rebates';
        if (catId === 'heat_pump_hvac') {
          utilityAmount = 1500 * multiplier;
          utilityDesc = 'LADWP General Consumer Rebate for ENERGY STAR Heating & Cooling heat pumps ($1,500/system)';
        } else if (catId === 'heat_pump_water_heater') {
          utilityAmount = 1000 * multiplier;
          utilityDesc = 'LADWP General Commercial/Residential Heat Pump Water Heater incentive ($1,000/unit)';
        } else if (catId === 'electrical_panel') {
          utilityAmount = 500 * multiplier;
          utilityDesc = 'LADWP Electrical Service Upgrade commercial customer rebate ($500/panel)';
        } else if (catId === 'ev_charger') {
          utilityAmount = 1000 * multiplier;
          utilityDesc = 'LADWP Charge Up LA Smart Multi-Unit Electric Vehicle Charger Incentive ($1,000/port)';
        } else if (catId === 'building_envelope') {
          utilityAmount = 400 * multiplier;
          utilityDesc = 'LADWP Energy Efficiency commercial insulation rebate ($400/zone)';
        }
      }
    } 
    else if (utility === 'SCE') {
      // Southern California Edison Stacking
      // ESA Multifamily Energy Savings / Direct Install (MFES)
      // Check eligibility: Deed-Restricted (Nonprofit) >=65% LMI, Non-Deed-Restricted (NOAH) >=80% LMI
      const qualifiesForMFES = (type === 'nonprofit' && percentTenantsLMI >= 65) || (type === 'noah' && percentTenantsLMI >= 80);

      if (qualifiesForMFES && ['building_envelope', 'heat_pump_water_heater'].includes(catId)) {
        programName = 'SCE ESA-MFES Program';
        utilityAmount = baseCost * 0.90; // High coverage up to 100% - let's model 90% direct subsidy
        utilityDesc = `SCE Energy Savings Assistance (ESA) Multifamily Energy Savings Program covers ~90% of equipment & labor [TRC/RHA Administered]`;
      } else if (qualifiesForMFES && catId === 'heat_pump_hvac') {
        programName = 'SCE Multifamily Direct Install';
        utilityAmount = baseCost * 0.75; // 75% coverage
        utilityDesc = `SCE Multifamily Residential Direct Install Program covering major duct seals, system tuning, and thermostats [Synergy Companies]`;
      } else {
        programName = 'SCE General Incentives';
        if (catId === 'heat_pump_hvac') {
          utilityAmount = 800 * multiplier;
          utilityDesc = 'SCE Clean Energy HVAC Heat Pump utility cash rebate ($800/system)';
        } else if (catId === 'heat_pump_water_heater') {
          utilityAmount = 800 * multiplier;
          utilityDesc = 'SCE central heat pump water heater rebate incentive ($800/unit)';
        } else if (catId === 'ev_charger') {
          utilityAmount = 1200 * multiplier;
          utilityDesc = 'SCE Charge Ready Multifamily Placement Incentive ($1,200/port)';
        }
      }
    }
    else if (utility === 'Burbank') {
      programName = 'BWP Municipal Rebates';
      if (catId === 'heat_pump_hvac') {
        utilityAmount = 1200 * multiplier;
        utilityDesc = 'Burbank Water & Power Heat Pump Space Heating rebate ($1,200/system)';
      } else if (catId === 'heat_pump_water_heater') {
        utilityAmount = 1000 * multiplier;
        utilityDesc = 'BWP Heat Pump Water Heater upgrade program ($1,000/heaters)';
      } else if (catId === 'building_envelope') {
        utilityAmount = baseCost * 0.30;
        utilityDesc = 'Burbank Water & Power Attic/Wall insulation energy rebate (30% of cost)';
      }
    }
    else if (utility === 'Glendale') {
      programName = 'GWP Municipal Programs';
      if (catId === 'heat_pump_hvac') {
        utilityAmount = 1500 * multiplier;
        utilityDesc = 'Glendale Water & Power residential heat pump upgrade cash rebate ($1,500/system)';
      } else if (catId === 'heat_pump_water_heater') {
        utilityAmount = 1250 * multiplier;
        utilityDesc = 'GWP Heat Pump Water Heater commercial/residential swap incentive ($1,250/unit)';
      } else if (catId === 'solar_pv' || catId === 'battery_storage') {
        utilityAmount = Math.min(8000, baseCost * 0.40); // Glendale + AQMD joint rebate covers up to $8K
        utilityDesc = 'Glendale GWP & SCAQMD Joint Clean Energy rebate covering 40% up to $8,000 cumulative';
      }
    }
    else if (utility === 'Pasadena') {
      programName = 'PWP Municipal Programs';
      if (catId === 'heat_pump_hvac') {
        utilityAmount = 1500 * multiplier;
        utilityDesc = 'Pasadena Water & Power Heat Pump customer rebate ($1,500/system)';
      } else if (catId === 'heat_pump_water_heater') {
        utilityAmount = 1250 * multiplier;
        utilityDesc = 'PWP Heat Pump Water Heater commercial swap-out incentive ($1,250/unit)';
      } else if (catId === 'solar_pv' || catId === 'battery_storage') {
        utilityAmount = Math.min(4000, baseCost * 0.30); // PWP Solar + Battery active pilot
        utilityDesc = 'Pasadena PWP Active Solar & Battery Storage Pilot (Approved April 2026)';
      } else if (catId === 'ev_charger') {
        utilityAmount = 600 * multiplier;
        utilityDesc = 'PWP Residential/Commercial Stacked L2 Charger rebate ($600/port)';
      }
    }
    else {
      // PG_AND_E or SDG_AND_E general checks
      programName = `${UTILITY_LABELS[utility]} Program`;
      if (catId === 'heat_pump_hvac') {
        utilityAmount = 1000 * multiplier;
        utilityDesc = `Standard Regional Utility HVAC Heat Pump rebate ($1,000/system)`;
      } else if (catId === 'heat_pump_water_heater') {
        utilityAmount = 900 * multiplier;
        utilityDesc = `Standard Regional Utility HPWH rebate ($900/unit)`;
      } else if (catId === 'ev_charger') {
        utilityAmount = 800 * multiplier;
        utilityDesc = `Standard Regional Utility EV Charger incentive ($800/port)`;
      }
    }

    // Stack SoCal Gas Comprehensive Multifamily Incentive (CoMFI) on water heater / envelope programs
    // SoCal Gas governs all LA territories (served gas is SCG across LADWP & SCE electrical borders)
    let scgCoMfiAmount = 0;
    if (['heat_pump_water_heater', 'building_envelope'].includes(catId)) {
      const qualifiesForCoMFI = percentTenantsLMI >= 60;
      if (qualifiesForCoMFI) {
        scgCoMfiAmount = Math.min(baseCost * 0.30, 2000 * unitsCount);
        incentives.push({
          id: `${catId}_scg_comfi`,
          name: 'SoCalGas CoMFI Program',
          type: 'utility_rebate',
          amount: scgCoMfiAmount,
          description: `SoCalGas Comprehensive Multifamily Incentive (CoMFI) for whole-building thermal efficiency updates (30% up to $2k/unit max) [RHA Administered]`,
        });
        totalCategoryRebates += scgCoMfiAmount;
      }
    }

    if (utilityAmount > 0) {
      utilityAmount = Math.min(utilityAmount, Math.max(0, baseCost - totalCategoryRebates));
      incentives.push({
        id: `${catId}_utility`,
        name: programName,
        type: 'utility_rebate',
        amount: utilityAmount,
        description: utilityDesc,
      });
      totalCategoryRebates += utilityAmount;
    }

    // Stack SoCalREN Multifamily for remaining balance on energy efficiency (attics/insulation/thermal)
    if (['heat_pump_hvac', 'heat_pump_water_heater', 'building_envelope'].includes(catId) && utility !== 'LADWP') {
      const remainingCost = Math.max(0, baseCost - totalCategoryRebates);
      const socalRenAmount = Math.min(remainingCost * 0.25, 1500 * unitsCount);
      if (socalRenAmount > 0) {
        incentives.push({
          id: `${catId}_socalren_mf`,
          name: 'SoCalREN Multifamily Stack',
          type: 'utility_rebate',
          amount: socalRenAmount,
          description: `SoCalREN Multifamily Energy Efficiency incentive covering 25% of eligible measures up to $1,500/unit [Willdan & The Energy Coalition administered]`,
        });
        totalCategoryRebates += socalRenAmount;
      }
    }

    // B. STATE REBATES LAYER (TECH Clean CA, CEC EBD, SOMAH, SGIP)
    let stateAmount = 0;
    let stateDesc = '';
    let stateName = 'California State Program';

    if (catId === 'heat_pump_hvac') {
      stateName = 'TECH Clean California';
      stateAmount = 1000 * multiplier;
      stateDesc = 'TECH Clean California Space Heating state incentives ($1,000 per outdoor heat pump unit) [AEA Administered]';
    } 
    else if (catId === 'heat_pump_water_heater') {
      stateName = 'TECH Clean California';
      // LMI tier receives an augmented rebate
      const HPWHRate = isLMI ? 3000 : 1500;
      stateAmount = HPWHRate * multiplier;
      stateDesc = `TECH Clean California Heat Pump Water Heater Incentive ($${HPWHRate.toLocaleString()} per unit for affordable/LMI properties) [AEA Administered]`;
    } 
    else if (catId === 'solar_pv') {
      // CA SOMAH Solar Rebate
      // Only available for Invested Owned Utilities (SCE, PG_AND_E, SDG_AND_E). For LADWP, CAMR offers VNEM.
      if (['SCE', 'PG_AND_E', 'SDG_AND_E'].includes(utility)) {
        const qualifiesForSOMAH = type === 'nonprofit' || isDAC;
        if (qualifiesForSOMAH && percentTenantsLMI >= 60) {
          stateName = 'CA SOMAH (Solar)';
          stateAmount = 2500 * multiplier; // Up to $2.50 per watt ($2,500/kW) direct developer/owner discount
          stateDesc = 'California Solar on Multifamily Affordable Housing (SOMAH) program covering up to 100% of solar equipment outlay [GRID Alternatives/AEA Administered]';
        }
      }
    } 
    else if (catId === 'battery_storage') {
      stateName = 'CA Self-Generation (SGIP)';
      // SGIP Equity Resilience budget covers up to $850 per kWh if DAC or low-income or has high hazard threats (wildfires)
      if (isEquityRegion || isLMI || isDAC) {
        stateAmount = 850 * multiplier;
        stateDesc = 'California SGIP Equity Resilience battery subsidy ($850/kWh capacity, capping complete battery outlay)';
      } else {
        stateAmount = 200 * multiplier;
        stateDesc = 'California SGIP Standard lithium storage technology rebate ($200/kWh capacity)';
      }
    }

    // Stack CEC's Equitable Building Decarbonization Direct Install Program (EBD)
    // Only works if in a Disadvantaged Community (DAC) and high low-income tenant concentration
    let ebdAmount = 0;
    if (['heat_pump_hvac', 'heat_pump_water_heater', 'building_envelope'].includes(catId) && isDAC && percentTenantsLMI >= 66) {
      const remainingForEBD = Math.max(0, baseCost - totalCategoryRebates - stateAmount);
      ebdAmount = Math.min(remainingForEBD * 0.80, 8000 * unitsCount);
      if (ebdAmount > 0) {
        incentives.push({
          id: `${catId}_cec_ebd`,
          name: 'CEC Equitable Building Decarb (EBD)',
          type: 'state_rebate',
          amount: ebdAmount,
          description: `CEC Equitable Building Decarbonization (EBD) direct-install program covering up to 80% of remaining installation outlay [Willdan Administered]`,
        });
        totalCategoryRebates += ebdAmount;
      }
    }

    if (stateAmount > 0) {
      stateAmount = Math.min(stateAmount, Math.max(0, baseCost - totalCategoryRebates));
      incentives.push({
        id: `${catId}_state`,
        name: stateName,
        type: 'state_rebate',
        amount: stateAmount,
        description: stateDesc,
      });
      totalCategoryRebates += stateAmount;
    }

    // C. FEDERAL ELECTRIFICATION REBATES LAYER (IRA HEEHRA / HOMES)
    let heehraEligibleMax = 0;
    let heehraPerc = 0;
    let heehraDesc = '';

    // Enforce eligibility rules based on building profile
    // Multifamily uses rent-restricted structures where percentage applies
    if (percentTenantsLMI >= 65 || incomeTier === 'low') {
      heehraPerc = 1.0; // 100% of rest covered up to limit
    } else if (percentTenantsLMI >= 50 || incomeTier === 'moderate') {
      heehraPerc = 0.5; // 50% of rest covered up to limit
    }

    if (heehraPerc > 0) {
      if (catId === 'heat_pump_hvac') {
        heehraEligibleMax = 8000 * multiplier;
        heehraDesc = `HEEHRA Decarbonization Heat Pump room/central space heating rebate (${heehraPerc * 100}% of cost up to $8,000/sys)`;
      } else if (catId === 'heat_pump_water_heater') {
        heehraEligibleMax = 4000 * multiplier;
        heehraDesc = `HEEHRA Decarbonization Heat Pump water heater rebate (${heehraPerc * 105}% of cost up to $4,000/unit)`;
      } else if (catId === 'electrical_panel') {
        heehraEligibleMax = 4000 * multiplier;
        heehraDesc = `HEEHRA Electrification Panel upgrade incentive (${heehraPerc * 100}% of cost up to $4,000/panel)`;
      } else if (catId === 'building_envelope') {
        heehraEligibleMax = 1600 * multiplier;
        heehraDesc = `HEEHRA Efficiency Insulation & Air Sealing upfront rebate (${heehraPerc * 100}% of cost up to $1,600)`;
      }
    }

    if (heehraEligibleMax > 0) {
      const remainingCost = Math.max(0, baseCost - totalCategoryRebates);
      let calculatedHeehra = remainingCost * heehraPerc;
      calculatedHeehra = Math.min(calculatedHeehra, heehraEligibleMax);

      // Enforce the $14k per-unit aggregate cap for building electrification
      const allowedHeehra = Math.min(calculatedHeehra, maxHeehraLimit - consumedHeehraRebateSum);

      if (allowedHeehra > 0) {
        incentives.push({
          id: `${catId}_heehra`,
          name: 'Federal IRA HEEHRA Rebate',
          type: 'federal_rebate',
          amount: allowedHeehra,
          description: heehraDesc + (allowedHeehra < calculatedHeehra ? ` (Capped by overall $${maxHeehraLimit.toLocaleString()} program building limit)` : ''),
        });
        totalCategoryRebates += allowedHeehra;
        consumedHeehraRebateSum += allowedHeehra;
      }
    }

    // D. FEDERAL TAX CREDITS LAYER (Section 25C / 25D or 45L / 179D)
    // Non-profit housing organizations can leverage the "Direct Pay / Elective Pay" rules passed in the IRA!
    // This allows tax-exempt nonprofit entities with no tax liability to claim 100% of these tax credits as a direct cash refund from the IRS!
    const qualifiesForFederalCredits = hasTaxLiability || type === 'nonprofit';

    if (qualifiesForFederalCredits) {
      let taxCreditAmount = 0;
      let taxDesc = '';

      const netCostForTaxBasis = Math.max(0, baseCost - totalCategoryRebates);
      const isDirectPay = type === 'nonprofit' && !hasTaxLiability;

      if (catId === 'solar_pv' || catId === 'battery_storage') {
        taxCreditAmount = netCostForTaxBasis * 0.3;
        taxDesc = `Section 25D Residential Clean Energy Tax Credit (30% of cost, uncapped)${isDirectPay ? ' claimed as Direct Paid refund for Nonprofits' : ''}`;
      }
      else if (catId === 'ev_charger') {
        const potentialCredit = netCostForTaxBasis * 0.3;
        const evCap = 1000 * multiplier;
        taxCreditAmount = Math.min(potentialCredit, evCap);
        taxDesc = `Section 30C Alternative Fuel Infrastructure Tax Credit (30% up to $1,000/port)${isDirectPay ? ' claimed as Direct Paid refund' : ''}`;
      }
      else if (catId === 'heat_pump_hvac' || catId === 'heat_pump_water_heater') {
        const potentialCredit = netCostForTaxBasis * 0.3;
        const comfortCap = 2000 * unitsCount;
        const comfortCapRemaining = comfortCap - comfortCreditClaimed;

        taxCreditAmount = Math.min(potentialCredit, comfortCapRemaining);
        taxDesc = `Section 25C Energy Efficient Home Credit (30% of cost up to $2,000 annual limit per unit)${isDirectPay ? ' claimed as Direct Paid refund' : ''}`;
        comfortCreditClaimed += taxCreditAmount;
      }
      else if (catId === 'electrical_panel') {
        const potentialCredit = netCostForTaxBasis * 0.3;
        const panelCap = 600 * unitsCount;
        taxCreditAmount = Math.min(potentialCredit, panelCap);
        taxDesc = `Section 25C Electrical Panel upgrade credit (30% up to $600 per unit)${isDirectPay ? ' claimed as Direct Refund' : ''}`;
      }
      else if (catId === 'building_envelope') {
        const potentialCredit = netCostForTaxBasis * 0.3;
        const envelopeCap = 1200 * unitsCount;
        const envelopeCapRemaining = envelopeCap - envelopeCreditClaimed;

        taxCreditAmount = Math.min(potentialCredit, envelopeCapRemaining);
        taxDesc = `Section 25C Building Envelope insulation tax deduction (30% up to $1,200 annual limit per unit)${isDirectPay ? ' claimed as Direct Paid refund' : ''}`;
        envelopeCreditClaimed += taxCreditAmount;
      }

      if (taxCreditAmount > 0) {
        taxCreditAmount = Math.min(taxCreditAmount, netCostForTaxBasis);
        incentives.push({
          id: `${catId}_tax`,
          name: isDirectPay ? 'Federal IRA Direct Pay (Refund)' : 'Federal IRA Tax Credit',
          type: 'federal_tax_credit',
          amount: taxCreditAmount,
          description: taxDesc,
        });
        totalCategoryTaxCredits += taxCreditAmount;
      }
    }

    const ownerNetCost = Math.max(0, baseCost - totalCategoryRebates - totalCategoryTaxCredits);

    rawResults[catId] = {
      baseCost,
      applicableIncentives: incentives,
      totalRebates: totalCategoryRebates,
      totalTaxCredits: totalCategoryTaxCredits,
      ownerNetCost,
    };
  }

  // Energy Bill savings multipliers (calibrated for commercial-scale multifamily in LA)
  const annualSavingsPerUnit: Record<UpgradeCategory, number> = {
    heat_pump_hvac: 380, // $380/yr per apartment energy savings
    heat_pump_water_heater: 290, // $290/yr per unit water savings (displace gas)
    solar_pv: 210, // $210/kW commercial commercial-scale solar offset
    battery_storage: 45, // $45/kWh storage arbitrage cuts
    electrical_panel: 10,
    ev_charger: 400, // fuel savings
    building_envelope: 220, // insulation
  };

  const co2SavingsPerUnit: Record<UpgradeCategory, number> = {
    heat_pump_hvac: 1200, // 1200 lbs CO2 saved per unit
    heat_pump_water_heater: 1100, // 1100 lbs
    solar_pv: 850, // 850 lbs per kW
    battery_storage: 90, // lbs saved per kWh
    electrical_panel: 0,
    ev_charger: 2800, // 2800 lbs per upgraded charger deployment
    building_envelope: 600, // 600 lbs CO2 saved
  };

  // Compile calculations in correct indices
  for (const catId of categories) {
    const rawVal = rawResults[catId] || {
      baseCost: 0,
      applicableIncentives: [],
      totalRebates: 0,
      totalTaxCredits: 0,
      ownerNetCost: 0,
    };

    const isSelected = selectedUpgrades[catId]?.selected || false;
    const multiplier = selectedUpgrades[catId]?.multiplier || 0;

    calculations.push({
      id: catId,
      name: DEFAULT_UPGRADES[catId].name,
      baseCost: rawVal.baseCost || 0,
      applicableIncentives: rawVal.applicableIncentives || [],
      totalRebates: rawVal.totalRebates || 0,
      totalTaxCredits: rawVal.totalTaxCredits || 0,
      ownerNetCost: rawVal.ownerNetCost || 0,
      estimatedAnnualSavings: isSelected ? annualSavingsPerUnit[catId] * multiplier : 0,
      estimatedCO2Savings: isSelected ? co2SavingsPerUnit[catId] * multiplier : 0,
    });
  }

  return calculations;
}

export function calculateSummary(calcs: UpgradeCalculation[]): TotalSummary {
  let grossCost = 0;
  let totalRebates = 0;
  let totalCredits = 0;
  let netCost = 0;
  let totalAnnualSavings = 0;
  let totalCO2Savings = 0;

  for (const c of calcs) {
    grossCost += c.baseCost;
    totalRebates += c.totalRebates;
    totalCredits += c.totalTaxCredits;
    netCost += c.ownerNetCost;
    totalAnnualSavings += c.estimatedAnnualSavings;
    totalCO2Savings += c.estimatedCO2Savings;
  }

  return {
    grossCost,
    totalRebates,
    totalCredits,
    netCost,
    totalAnnualSavings,
    totalCO2Savings,
  };
}
