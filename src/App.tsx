/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PropertyConfig, UpgradeCategory, UpgradeItem, UpgradeCalculation, TotalSummary, Scenario } from './types';
import { calculateIncentives, calculateSummary, UTILITY_LABELS } from './utils';
import InteractiveChart from './components/InteractiveChart';
import SavedScenarios from './components/SavedScenarios';
import IncentiveAdvisor from './components/IncentiveAdvisor';
import { 
  Home, 
  Building2, 
  Sliders, 
  SlidersHorizontal,
  Info, 
  HelpCircle, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  BadgeCheck, 
  ShieldCheck,
  CheckCircle,
  Leaf,
  Plus,
  Minus,
  Sparkle
} from 'lucide-react';

export default function App() {
  // 1. Initial Property Setup (Focusing on Naturally Occurring Affordable Housing of 5-49 units)
  const [property, setProperty] = useState<PropertyConfig>({
    type: 'noah',
    unitsCount: 12, // 12-unit is right in the middle of 5-49 sweet spot
    zipCode: '90012',
    utility: 'LADWP',
    incomeTier: 'low',
    hasTaxLiability: true,
    isEquityRegion: true,
    isDAC: true,
    percentTenantsLMI: 80, // naturally occurring low-income renters
  });

  // 2. Initial Upgrades Item Matrix State scaled to 12 units
  const [upgradesState, setUpgradesState] = useState<Record<UpgradeCategory, { selected: boolean; unitCost: number; multiplier: number }>>({
    heat_pump_hvac: {
      selected: true,
      unitCost: 11000,
      multiplier: 12, // scaled 1 per unit for 12 units
    },
    heat_pump_water_heater: {
      selected: true,
      unitCost: 4500,
      multiplier: 12, // scaled to 12 units
    },
    solar_pv: {
      selected: true,
      unitCost: 3500, // per kW
      multiplier: 30, // 30 kW Commercial / Multifamily system
    },
    battery_storage: {
      selected: false,
      unitCost: 950, // per kWh
      multiplier: 20, // 20 kWh block
    },
    electrical_panel: {
      selected: false,
      unitCost: 4500,
      multiplier: 1,
    },
    ev_charger: {
      selected: false,
      unitCost: 1200,
      multiplier: 4, // 4 ports
    },
    building_envelope: {
      selected: false,
      unitCost: 3000,
      multiplier: 1,
    },
  });

  // Auto-sync multipliers for HVAC & HP WH when unitsCount changes
  useEffect(() => {
    setUpgradesState(prev => {
      const next = { ...prev };
      if (next.heat_pump_hvac.multiplier !== property.unitsCount) {
        next.heat_pump_hvac.multiplier = property.unitsCount;
      }
      if (next.heat_pump_water_heater.multiplier !== property.unitsCount) {
        next.heat_pump_water_heater.multiplier = property.unitsCount;
      }
      return next;
    });
  }, [property.unitsCount]);

  // Track which upgrade collapsible card is currently open
  const [expandedUpgradeId, setExpandedUpgradeId] = useState<UpgradeCategory | null>('heat_pump_hvac');

  // Workflow steps: 'address' (Step 1), 'details' (Step 2), 'results' (Step 3 Calculator Workspace)
  const [workflowStep, setWorkflowStep] = useState<'address' | 'details' | 'results'>('address');
  const [addressInput, setAddressInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStage, setAnalyzingStage] = useState(0);

  // Preset verified address database for easy simulation matches
  const PRESET_ADDRESSES = [
    {
      address: '611 S Lorena St, Los Angeles, CA 90023',
      county: 'Los Angeles County',
      utility: 'LADWP' as const,
      zipCode: '90023',
      unitsCount: 45,
      lowIncomeUnits: 45,
      isDAC: true,
      isEquityRegion: true,
      type: 'noah' as const,
      desc: 'Boyle Heights multifamily asset. Vetted under CalEnviroScreen 4.0: High DAC priority, LADWP territory, perfect 5-49 middle market profile.'
    },
    {
      address: '1312 S Vermont Ave, Los Angeles, CA 90006',
      county: 'Los Angeles County',
      utility: 'LADWP' as const,
      zipCode: '90006',
      unitsCount: 24,
      lowIncomeUnits: 24,
      isDAC: true,
      isEquityRegion: true,
      type: 'nonprofit' as const,
      desc: 'Koreatown Nonprofit Housing (501c3). Qualifies for 100% LADWP CAMR coverage & CA SOMAH virtual solar net metering.'
    },
    {
      address: '1501 E Grand Ave, El Segundo, CA 90245',
      county: 'Los Angeles County',
      utility: 'SCE' as const,
      zipCode: '90245',
      unitsCount: 12,
      lowIncomeUnits: 8,
      isDAC: false,
      isEquityRegion: false,
      type: 'noah' as const,
      desc: 'El Segundo privately owned apartment complex. Standard Southern California Edison (SCE) grid service.'
    },
    {
      address: '220 N Broadway, Pasadena, CA 91101',
      county: 'Los Angeles County',
      utility: 'Pasadena' as const,
      zipCode: '91101',
      unitsCount: 30,
      lowIncomeUnits: 25,
      isDAC: false,
      isEquityRegion: true,
      type: 'nonprofit' as const,
      desc: 'Pasadena Senior Cooperative Living block. Qualifies for high wildfire safety battery storage and Pasadena PWP Solar Pilot.'
    }
  ];

  // Geocoding & Environmental Map Alignment Analysis simulation
  const startAddressGeocoding = (selectedAddress: string) => {
    setIsAnalyzing(true);
    setAnalyzingStage(0);
    setAddressInput(selectedAddress);

    // Multi-phase diagnostics sequencing
    const phase1 = setTimeout(() => setAnalyzingStage(1), 400);
    const phase2 = setTimeout(() => setAnalyzingStage(2), 800);
    const phase3 = setTimeout(() => {
      // Direct property configuration alignments
      const match = PRESET_ADDRESSES.find(p => p.address.startsWith(selectedAddress.split(',')[0])) || {
        address: selectedAddress,
        county: 'Los Angeles County',
        utility: selectedAddress.toLowerCase().includes('pasadena') ? 'Pasadena' as const
               : selectedAddress.toLowerCase().includes('burbank') ? 'Burbank' as const
               : selectedAddress.toLowerCase().includes('glendale') ? 'Glendale' as const
               : selectedAddress.toLowerCase().includes('san diego') ? 'SDG_AND_E' as const
               : selectedAddress.toLowerCase().includes('san francisco') ? 'PG_AND_E' as const
               : 'LADWP' as const,
        zipCode: selectedAddress.match(/\b\d{5}\b/)?.[0] || '90012',
        unitsCount: 12,
        lowIncomeUnits: 10,
        isDAC: selectedAddress.toLowerCase().includes('lorena') || selectedAddress.toLowerCase().includes('vermont') || Math.random() > 0.45,
        isEquityRegion: true,
        type: 'noah' as const,
      };

      setProperty({
        type: match.type,
        unitsCount: match.unitsCount,
        zipCode: match.zipCode,
        utility: match.utility,
        percentTenantsLMI: match.unitsCount > 0 ? Math.round((match.lowIncomeUnits / match.unitsCount) * 100) : 80,
        isDAC: match.isDAC,
        isEquityRegion: match.isEquityRegion,
        hasTaxLiability: match.type === 'noah',
        incomeTier: 'low',
      });

      setIsAnalyzing(false);
      setWorkflowStep('details');
    }, 1200);
  };

  // Load Scenario Handler from SavedScenarios list
  const handleLoadScenario = (sc: Scenario) => {
    setProperty(sc.property);
    
    const loadedState: Record<UpgradeCategory, { selected: boolean; unitCost: number; multiplier: number }> = {} as any;
    (Object.keys(sc.itemsState) as UpgradeCategory[]).forEach(catId => {
      loadedState[catId] = {
        selected: sc.selectedUpgradeIds.includes(catId),
        unitCost: sc.itemsState[catId].unitCost,
        multiplier: sc.itemsState[catId].multiplier,
      };
    });
    setUpgradesState(loadedState);
    setWorkflowStep('results'); // Instantly view detailed metrics
  };

  // Adjust defaults if ownership profile changes
  const handlePropertyTypeChange = (newType: 'noah' | 'nonprofit') => {
    setProperty(prev => ({
      ...prev,
      type: newType,
      percentTenantsLMI: newType === 'nonprofit' ? 100 : prev.percentTenantsLMI,
      hasTaxLiability: newType === 'noah', // Nonprofits usually use direct pay (no tax liability), NOAH has standard liability
    }));
  };

  const handleZipCodeChange = (val: string) => {
    // Basic LA area check: common LA County codes starting with 90, 91, or 93
    const isLA = val.startsWith('90') || val.startsWith('91');
    setProperty(prev => ({
      ...prev,
      zipCode: val,
      // Default to LADWP if LA area is set, otherwise default SCE for general SoCal
      utility: isLA ? 'LADWP' : prev.utility === 'LADWP' ? 'SCE' : prev.utility,
    }));
  };

  // Upgrades interaction triggers
  const toggleUpgradeSelection = (catId: UpgradeCategory) => {
    setUpgradesState(prev => {
      const active = prev[catId].selected;
      return {
        ...prev,
        [catId]: {
          ...prev[catId],
          selected: !active,
        }
      };
    });
  };

  const updateUpgradeMultiplier = (catId: UpgradeCategory, delta: number) => {
    setUpgradesState(prev => {
      const current = prev[catId].multiplier;
      const next = Math.max(1, current + delta);
      return {
        ...prev,
        [catId]: {
          ...prev[catId],
          multiplier: next,
        }
      };
    });
  };

  const updateUpgradeCost = (catId: UpgradeCategory, newCost: number) => {
    setUpgradesState(prev => {
      return {
        ...prev,
        [catId]: {
          ...prev[catId],
          unitCost: Math.max(100, newCost),
        }
      };
    });
  };

  // Perform calculations on state
  const calculations = calculateIncentives(property, upgradesState);
  const summary = calculateSummary(calculations);

  const isLAZip = property.zipCode.startsWith('90') || property.zipCode.startsWith('91');

  // Render individual upgrade card
  const renderUpgradeRow = (calc: UpgradeCalculation) => {
    const isSelected = upgradesState[calc.id].selected;
    const isExpanded = expandedUpgradeId === calc.id;
    const itemState = upgradesState[calc.id];

    // Multiplier naming conventions: Units, kW, kWh
    let multiplierLabel = 'Units';
    if (calc.id === 'solar_pv') multiplierLabel = 'kW System';
    else if (calc.id === 'battery_storage') multiplierLabel = 'kWh Battery';
    else if (calc.id === 'ev_charger') multiplierLabel = 'Ports';

    return (
      <div 
        key={calc.id} 
        id={`card_${calc.id}`}
        className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
          isSelected 
            ? 'border-emerald-600 bg-white shadow-sm' 
            : 'border-neutral-200/80 bg-neutral-50/55 hover:bg-neutral-50'
        }`}
      >
        {/* Row Header */}
        <div 
          className="p-5 flex items-start gap-4 select-none cursor-pointer"
          onClick={() => toggleUpgradeSelection(calc.id)}
        >
          {/* Custom checkbox */}
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <input 
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleUpgradeSelection(calc.id)}
              className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5 cursor-pointer"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h4 className="text-sm font-bold text-neutral-850 truncate">{calc.name}</h4>
              {isSelected && (
                <div className="flex items-baseline gap-2 font-mono shrink-0">
                  <span className="text-[11px] text-neutral-400">Net Cost:</span>
                  <span className="text-sm font-bold text-emerald-700">
                    ${calc.ownerNetCost.toLocaleString()}
                  </span>
                  {calc.totalRebates + calc.totalTaxCredits > 0 && (
                    <span className="text-[10px] text-neutral-450 line-through">
                      ${calc.baseCost.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-[11px] text-neutral-500 mt-1 leading-normal pr-4">
              {calc.id === 'heat_pump_hvac' && 'Highly efficient electric split systems for central heating & cooling, replacing gas furnaces.'}
              {calc.id === 'heat_pump_water_heater' && 'Electric heat pump water heaters, utilizing ambient air heat. Delivers 3-4x more efficiency than gas.'}
              {calc.id === 'solar_pv' && 'Rooftop solar panel system to generate clean electricity and offset utility rates.'}
              {calc.id === 'battery_storage' && 'Lithium battery backup to store solar energy, avoid peak rates, and provide resiliency.'}
              {calc.id === 'electrical_panel' && 'Upgrades to the main electrical panel (e.g., 100A to 200A) to support charging and heat pump loads.'}
              {calc.id === 'ev_charger' && 'Universal smart EV chargers (Level 2, 240V, 32-48A) for convenient and cheap overnight charging.'}
              {calc.id === 'building_envelope' && 'Duct sealing, wall/attic insulation, and weather stripping to block air leaks.'}
            </p>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {/* Expand Toggle Link */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedUpgradeId(isExpanded ? null : calc.id);
                }}
                className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 transition flex items-center gap-1 cursor-pointer"
              >
                {isExpanded ? (
                  <>Hide pricing tools <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Show pricing & layout options <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>

              {isSelected && (
                <div className="flex gap-3 text-[10px] uppercase font-bold text-neutral-400 font-mono tracking-wide">
                  <span>Rebates: <span className="text-indigo-655 font-bold">${calc.totalRebates.toLocaleString()}</span></span>
                  <span>Tax Credits: <span className="text-teal-655 font-bold">${calc.totalTaxCredits.toLocaleString()}</span></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible pricing panel */}
        {isExpanded && (
          <div className="border-t border-neutral-200/65 bg-neutral-50/45 p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Unit costs & multiplier adjusts */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                  Configurator Panel
                </h5>

                {/* Multiplier Slider/Buttons */}
                <div>
                  <label className="text-xs text-neutral-600 block mb-1 text-sm font-medium">
                    Upgrade Scale ({multiplierLabel}): <span className="font-bold text-neutral-900 font-mono">{itemState.multiplier}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateUpgradeMultiplier(calc.id, -1)}
                      className="h-8 w-8 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center cursor-pointer font-bold text-neutral-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max={property.type === 'multifamily' ? '80' : '20'}
                      value={itemState.multiplier}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setUpgradesState(prev => ({
                          ...prev,
                          [calc.id]: { ...prev[calc.id], multiplier: val }
                        }));
                      }}
                      className="flex-1 accent-emerald-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => updateUpgradeMultiplier(calc.id, 1)}
                      className="h-8 w-8 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center cursor-pointer font-bold text-neutral-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Estimate Cost override slider */}
                <div>
                  <label className="text-xs text-neutral-600 block mb-1 text-sm font-medium">
                    Unit Cost (Est): <span className="font-bold text-neutral-900 font-mono">${itemState.unitCost.toLocaleString()}</span>
                  </label>
                  
                  <input
                    type="range"
                    min={calc.id === 'solar_pv' ? '1500' : '500'}
                    max={calc.id === 'heat_pump_hvac' ? '20000' : '8000'}
                    step={calc.id === 'solar_pv' ? '100' : '250'}
                    value={itemState.unitCost}
                    onChange={(e) => updateUpgradeCost(calc.id, parseInt(e.target.value))}
                    className="w-full accent-emerald-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-neutral-450 mt-1">
                    <span>Min</span>
                    <span>Max</span>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 bg-white p-2 border border-neutral-200/50 rounded-lg leading-normal">
                  <span className="font-bold text-neutral-700">Project Baseline:</span> Total installation budget is calculated at <span className="font-mono font-bold text-neutral-800">${(itemState.unitCost * itemState.multiplier).toLocaleString()}</span> gross capital outlay.
                </div>
              </div>

              {/* Stacked Program list */}
              <div className="space-y-3.5">
                <h5 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                  Stackable Incentives Output
                </h5>

                {!isSelected ? (
                  <div className="text-xs text-neutral-500 bg-white border border-neutral-200 p-4 rounded-xl text-center">
                    Check the upgrade on the left checkbox to activate stackable funding program options.
                  </div>
                ) : calc.applicableIncentives.length === 0 ? (
                  <div className="text-xs text-neutral-400 bg-white border border-dashed border-neutral-200 p-4 rounded-xl text-center">
                    No active qualifying incentive programs with this income tier or tax liability status.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calc.applicableIncentives.map((inc) => (
                      <div 
                        key={inc.id}
                        className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs flex items-start gap-2.5 transition duration-150 hover:border-neutral-300"
                      >
                        {inc.type === 'federal_tax_credit' && (
                          <div className="p-1 bg-teal-50 text-teal-700 rounded border border-teal-200 font-bold font-mono text-[9px] uppercase tracking-wide cursor-help shrink-0" title="Claimed during tax filing">
                            25C/D
                          </div>
                        )}
                        {inc.type === 'federal_rebate' && (
                          <div className="p-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold font-mono text-[9px] uppercase tracking-wide shrink-0" title="Upfront Point-of-Sale Rebate">
                            HEE
                          </div>
                        )}
                        {inc.type === 'utility_rebate' && (
                          <div className="p-1 bg-cyan-50 text-cyan-700 rounded border border-cyan-200 font-bold font-mono text-[9px] uppercase tracking-wide shrink-0" title="Local Utility Cash Rebate">
                            UTIL
                          </div>
                        )}
                        {inc.type === 'state_rebate' && (
                          <div className="p-1 bg-amber-50 text-amber-700 rounded border border-amber-200 font-bold font-mono text-[9px] uppercase tracking-wide shrink-0" title="State Funded Incentive">
                            STATE
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-2">
                            <p className="text-[11px] font-bold text-neutral-800 truncate">{inc.name}</p>
                            <span className="text-[11px] font-bold font-mono text-neutral-900 shrink-0">
                              -${inc.amount.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-450 leading-relaxed mt-0.5">
                            {inc.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    );
  };

  // Render main step-by-step wizard workflow based on current step
  if (workflowStep === 'address') {
    return (
      <div className="min-h-screen bg-retrofit-dark text-white font-sans flex flex-col justify-between selection:bg-retrofit-green/30">
        
        {/* Upper Accent Rail */}
        <div className="border-b border-white/[0.08] text-[10px] sm:text-xs font-mono text-center py-2.5 px-4 flex justify-between items-center text-white/60 font-medium tracking-wide">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-retrofit-green animate-pulse" />
            Active Stacking Simulator v4.5
          </span>
          <span className="opacity-75">MULTIFAMILY PORTAL (5-49 UNITS)</span>
        </div>

        {/* Outer Grid Center Content */}
        <div className="flex-1 w-full max-w-lg mx-auto px-4 py-12 md:py-24 flex flex-col items-center justify-center animate-fade-in">
          
          {/* Header */}
          <div className="w-full flex flex-col items-center text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-retrofit-green/30 bg-retrofit-dark text-[10px] tracking-wider text-retrofit-green uppercase font-mono mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-retrofit-green animate-pulse" />
              RETROFIT.LA · LOS ANGELES, CA
            </div>

            {/* Rooftop/Forward Motion R Logo */}
            <div className="flex items-center gap-2.5 mb-4">
              <svg className="h-9 w-9 text-retrofit-green" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13L10 6L14 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 6H17C19.2091 6 21 7.79086 21 10C21 12.2091 19.2091 14 17 14H10V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 14L20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 17H21V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-2xl font-black font-display tracking-tight text-white uppercase">Retrofit.LA</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
              Incentive Stack <span className="text-retrofit-sky">Calculator</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-md leading-relaxed font-sans">
              Enter your property address to see which decarbonization incentive programs you qualify for — and how much of your retrofit they can cover.
            </p>
          </div>

          {/* Stacking Input Card */}
          <div className="w-full bg-[#0a1b3a] rounded-2xl border border-white/[0.08] p-6 shadow-2xl relative overflow-hidden">
            
            {isAnalyzing ? (
              <div className="py-10 flex flex-col items-center text-center space-y-4">
                <div className="relative h-12 w-12 flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-retrofit-sky opacity-25" />
                  <div className="h-10 w-10 border-4 border-retrofit-sky/35 border-t-retrofit-green rounded-full animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-wider uppercase font-mono text-retrofit-sky">
                    {analyzingStage === 0 && 'Locating GIS parcel boundaries...'}
                    {analyzingStage === 1 && 'Querying regional grid territory...'}
                    {analyzingStage === 2 && 'Vetting CalEnviroScreen 4.0 status...'}
                  </h4>
                  <p className="text-[11px] text-neutral-450 mt-1.5">
                    Aligning municipal, state, and federal energy databases...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (addressInput.trim()) startAddressGeocoding(addressInput); }} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 font-mono">
                    PROPERTY ADDRESS
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 611 S Lorena St, Los Angeles, CA"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      className="flex-1 bg-retrofit-dark text-white placeholder-white/30 text-xs sm:text-sm rounded-xl border border-white/10 px-3.5 py-3 focus:outline-none focus:border-retrofit-sky focus:ring-1 focus:ring-retrofit-sky font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!addressInput.trim()}
                      className="px-5 py-3 rounded-xl bg-retrofit-sky hover:bg-retrofit-sky/95 text-retrofit-dark font-extrabold text-[11px] uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 shrink-0 font-sans"
                    >
                      Look Up →
                    </button>
                  </div>
                </div>

                {/* Info Advisory Panel */}
                <div className="bg-retrofit-sky/5 p-4 rounded-xl border-l-[3.5px] border-retrofit-sky text-left flex items-start gap-3">
                  <Info className="h-5 w-5 text-retrofit-sky shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-350 leading-relaxed font-sans">
                    Your address is used to check county, utility territory, and Disadvantaged Community status — which affects which programs you qualify for. Address is not stored.
                  </p>
                </div>

                {/* Clickable Quick-fill Presets */}
                <div className="pt-3.5 border-t border-white/[0.05]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono mb-2.5">
                    Quick check optimized Los Angeles multifamily parcels:
                  </p>
                  <div className="space-y-2">
                    {PRESET_ADDRESSES.map((p) => (
                      <button
                        key={p.address}
                        type="button"
                        onClick={() => startAddressGeocoding(p.address)}
                        className="w-full text-left p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition duration-150 flex flex-col gap-1 cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white font-mono text-xs">{p.address.split(',')[0]}</span>
                          <span className="text-[9px] font-bold text-retrofit-green bg-retrofit-green/10 border border-retrofit-green/20 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                            {p.utility}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-450 leading-snug line-clamp-1">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}

          </div>

          {!isAnalyzing && (
            <button
              type="button"
              onClick={() => {
                setProperty(prev => ({
                  ...prev,
                  unitsCount: 12,
                  percentTenantsLMI: 80,
                  type: 'noah',
                }));
                // Set default inputs
                setWorkflowStep('details');
              }}
              className="mt-6 text-xs text-neutral-400 hover:text-white transition duration-200 underline tracking-wide cursor-pointer font-medium"
            >
              Skip — enter county and utility manually
            </button>
          )}

        </div>

        {/* Footer */}
        <footer className="py-4 border-t border-white/[0.05] text-center text-[10px] text-neutral-500 font-medium">
          © {new Date().getFullYear()} Retrofit LA / Sustento. All rights reserved. Vetted by clean engineering.
        </footer>
      </div>
    );
  }

  if (workflowStep === 'details') {
    const calculatedLmiUnits = Math.round((property.percentTenantsLMI / 100) * property.unitsCount);
    return (
      <div className="min-h-screen bg-retrofit-dark text-white font-sans flex flex-col justify-between selection:bg-retrofit-green/30">
        
        {/* Upper Accent Rail */}
        <div className="border-b border-white/[0.08] text-[10px] sm:text-xs font-mono text-center py-2.5 px-4 flex justify-between items-center text-white/60 font-medium tracking-wide">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-retrofit-green animate-pulse" />
            Active Stacking Simulator v4.5
          </span>
          <span className="opacity-75">STAGED CONFIGURATION</span>
        </div>

        {/* Outer Grid Form */}
        <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 md:py-16 flex flex-col justify-center animate-fade-in">
          
          {/* Header */}
          <div className="w-full flex flex-col items-center text-center mb-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-4">
              <svg className="h-8 w-8 text-retrofit-green" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13L10 6L14 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 6H17C19.2091 6 21 7.79086 21 10C21 12.2091 19.2091 14 17 14H10V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 14L20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 17H21V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xl font-extrabold tracking-tight uppercase font-display text-white">Retrofit.LA</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Incentive Stack <span className="text-retrofit-sky">Calculator</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
              Confirm or adjust your building metrics below to prepare your dynamic decarbonization stacking model.
            </p>
          </div>

          <div className="w-full bg-[#0a1b3a] rounded-2xl border border-white/[0.08] p-6 shadow-2xl">
            <div className="space-y-5">
              
              {/* County & Utility Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 font-mono tracking-widest uppercase">COUNTY</label>
                  <select
                    value="Los Angeles County"
                    disabled
                    className="w-full text-xs text-white/50 bg-retrofit-dark rounded-xl border border-white/10 px-3 py-2.5 cursor-not-allowed font-sans"
                  >
                    <option value="Los Angeles County">Los Angeles County</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 font-mono tracking-widest uppercase">UTILITY</label>
                  <select
                    value={property.utility}
                    onChange={(e) => setProperty(prev => ({ ...prev, utility: e.target.value as any }))}
                    className="w-full text-xs text-white bg-retrofit-dark rounded-xl border border-white/10 px-3 py-2.5 focus:border-retrofit-sky focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="LADWP">LADWP (LA City)</option>
                    <option value="SCE">SCE (SoCal Edison)</option>
                    <option value="Burbank">BWP (Burbank)</option>
                    <option value="Glendale">GWP (Glendale)</option>
                    <option value="Pasadena">PWP (Pasadena)</option>
                    <option value="PG_AND_E">PG&E (Northern CA)</option>
                    <option value="SDG_AND_E">SDG&E (San Diego)</option>
                  </select>
                </div>
              </div>

              {/* Units Pickers */}
              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 font-mono tracking-widest uppercase">TOTAL UNITS</label>
                  <input
                    type="number"
                    min={5}
                    max={499}
                    value={property.unitsCount}
                    onChange={(e) => {
                      const val = Math.max(5, parseInt(e.target.value) || 5);
                      setProperty(prev => ({
                        ...prev,
                        unitsCount: val,
                        percentTenantsLMI: Math.min(prev.percentTenantsLMI, 100)
                      }));
                    }}
                    className="w-full text-xs text-white bg-retrofit-dark rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-retrofit-sky focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 font-mono tracking-widest uppercase">LOW-INCOME UNITS</label>
                  <input
                    type="number"
                    min={0}
                    max={property.unitsCount}
                    value={calculatedLmiUnits}
                    onChange={(e) => {
                      const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), property.unitsCount);
                      const pct = property.unitsCount > 0 ? Math.round((val / property.unitsCount) * 100) : 0;
                      setProperty(prev => ({
                        ...prev,
                        percentTenantsLMI: pct
                      }));
                    }}
                    className="w-full text-xs text-white bg-retrofit-dark rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-retrofit-sky focus:outline-none font-mono"
                  />
                  <span className="text-[9px] text-neutral-450 mt-1 block tracking-tight font-medium text-right font-mono">
                    = {property.percentTenantsLMI}% ratio (at or below 80% AMI)
                  </span>
                </div>
              </div>

              {/* Rent Roll Advisor Info Box */}
              <div className="bg-retrofit-sky/5 p-4 rounded-xl border-l-[3.5px] border-retrofit-sky text-left flex items-start gap-3">
                <Info className="h-5 w-5 text-retrofit-sky shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-neutral-350 leading-relaxed font-sans">
                  This is an estimate. Count units where tenant income is at or below 80% AMI — from your rent roll. Don't have the exact number? Enter your best guess. When you apply for Financial TA, you'll have the option to upload an anonymous rent roll for a more precise calculation.
                </p>
              </div>

              {/* Organization Type Selection */}
              <div>
                <label className="text-[10px] font-bold text-neutral-400 block mb-2 font-mono tracking-widest uppercase">ORGANIZATION TYPE</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePropertyTypeChange('nonprofit')}
                    className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-xs font-bold uppercase tracking-wider cursor-pointer text-center ${
                      property.type === 'nonprofit'
                        ? 'border-retrofit-green bg-white/[0.04] text-retrofit-green shadow-lg shadow-retrofit-green/5'
                        : 'border-white/10 text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <ShieldCheck className="h-4.5 w-4.5 text-retrofit-green" /> 501(c)(3) Nonprofit
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePropertyTypeChange('noah')}
                    className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-xs font-bold uppercase tracking-wider cursor-pointer text-center ${
                      property.type === 'noah'
                        ? 'border-retrofit-green bg-white/[0.04] text-retrofit-green shadow-lg shadow-retrofit-green/5'
                        : 'border-white/10 text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <Building2 className="h-4.5 w-4.5 text-retrofit-sky" /> For-Profit / Other
                  </button>
                </div>
              </div>

              {/* Big High Contrast Green Execution Button */}
              <button
                type="button"
                onClick={() => setWorkflowStep('results')}
                className="w-full bg-[#A2E543] hover:bg-[#8CD02F] text-[#021230] hover:scale-[1.01] transform font-extrabold uppercase py-4 rounded-xl text-center text-sm tracking-widest flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 mt-5 shadow-xl shadow-retrofit-green/10 font-sans"
              >
                CALCULATE MY INCENTIVE STACK
                <span className="font-sans text-md font-bold">→</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkflowStep('address')}
                className="w-full text-center text-xs text-neutral-400 hover:text-white transition mt-3 underline"
              >
                ← Back to address look up
              </button>

            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 border-t border-white/[0.05] text-center text-[10px] text-neutral-500 font-medium">
          © {new Date().getFullYear()} Retrofit LA / Sustento. All rights reserved. Vetted by clean engineering.
        </footer>
      </div>
    );
  }

  // Step 3: Calculator Workspace View (Results Mode)
  const lmiUnitsCount = Math.round((property.percentTenantsLMI / 100) * property.unitsCount);
  return (
    <div className="min-h-screen bg-[#fbfcfa] text-neutral-850 font-sans leading-relaxed selection:bg-emerald-100 flex flex-col justify-between">
      
      {/* Dynamic Upper Accent Rail */}
      <div className="bg-retrofit-dark text-white/90 text-[11px] font-mono text-center py-2.5 px-4 flex justify-between items-center border-b border-retrofit-dark font-medium uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-retrofit-green animate-pulse" />
          Retrofit LA Stacking Workspace
        </span>
        <button
          onClick={() => setWorkflowStep('address')}
          className="text-[10px] text-retrofit-sky hover:text-white underline tracking-wide font-mono cursor-pointer transition-colors"
        >
          ← Change Property Address
        </button>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 flex-1 animate-fade-in">
        
        {/* Custom Header branded for Retrofit.LA */}
        <header className="mb-10 md:mb-12 border-b border-neutral-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-retrofit-blue rounded-2xl flex items-center justify-center border border-retrofit-blue text-white shadow-md">
              <svg className="h-6 w-6 text-retrofit-green" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13L10 6L14 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 6H17C19.2091 6 21 7.79086 21 10C21 12.2091 19.2091 14 17 14H10V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 14L20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 17H21V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#021230] font-sans tracking-tight">
                  Incentive Stack Workspace
                </h1>
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase bg-retrofit-sky/10 text-retrofit-blue px-2 py-0.5 rounded border border-retrofit-sky/20">
                  {property.type === 'noah' ? 'NOAH Asset' : 'Nonprofit'}
                </span>
              </div>
              <p className="text-xs md:text-sm text-neutral-550 mt-1 leading-normal max-w-2xl font-sans">
                Real-time program integration for {property.unitsCount}-unit buildings. Dynamic stacks computed across LADWP, SCE, SoCalREN, SOMAH, TECH Clean CA, and IRA Elective/Direct Pay provisions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWorkflowStep('details')}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[#021230] font-bold text-xs rounded-xl uppercase tracking-wider transition-colors cursor-pointer font-sans"
            >
              Adjust Input Staging
            </button>
          </div>
        </header>

        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUMN 1: CONTROLS & PERSISTENCE & CHAT (Column span 5) */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Property Parameters Form */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-widest flex items-center gap-2 mb-5">
                <Sliders className="h-4.5 w-4.5 text-retrofit-blue" /> Quick Adjustment Console
              </h2>

              <div className="space-y-4">
                
                {/* Type Selection Tabs */}
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase font-mono block mb-2">Housing Profile</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePropertyTypeChange('noah')}
                      className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition text-[11px] font-bold uppercase tracking-wide cursor-pointer text-center ${
                        property.type === 'noah'
                          ? 'border-retrofit-dark bg-[#021230] text-white shadow-sm'
                          : 'border-neutral-200 text-neutral-600 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <Building2 className="h-4 w-4" /> Naturally Occurring (NOAH)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePropertyTypeChange('nonprofit')}
                      className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition text-[11px] font-bold uppercase tracking-wide cursor-pointer text-center ${
                        property.type === 'nonprofit'
                          ? 'border-retrofit-dark bg-[#021230] text-white shadow-sm'
                          : 'border-neutral-200 text-neutral-600 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" /> Nonprofit Affordable
                    </button>
                  </div>
                </div>

                {/* Units Sliders */}
                <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/50 space-y-4">
                  {/* Total Units slider */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-neutral-700">Total physical units</span>
                      <span className="font-mono font-bold text-[#021230]">{property.unitsCount} Units</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={property.unitsCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setProperty(prev => ({
                          ...prev,
                          unitsCount: val,
                          percentTenantsLMI: Math.min(prev.percentTenantsLMI, 100)
                        }));
                      }}
                      className="w-full accent-retrofit-blue h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-neutral-400 mt-1">
                      <span>5 Units</span>
                      <span>100 Units</span>
                    </div>
                  </div>

                  {/* Low-Income Units count details */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-neutral-700">Low-income tenant units (≤80% AMI)</span>
                      <span className="font-mono font-bold text-retrofit-blue">{lmiUnitsCount} of {property.unitsCount}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={property.unitsCount}
                      value={lmiUnitsCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const pct = property.unitsCount > 0 ? Math.round((val / property.unitsCount) * 100) : 0;
                        setProperty(prev => ({
                          ...prev,
                          percentTenantsLMI: pct
                        }));
                      }}
                      className="w-full accent-[#A2E543] h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-neutral-400 mt-1">
                      <span>0 Units</span>
                      <span>{property.unitsCount} Units Max ({property.percentTenantsLMI}%)</span>
                    </div>
                  </div>
                </div>

                {/* Zip box & Utilities sync */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase font-mono block mb-1">Zip Code</label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={5}
                        value={property.zipCode}
                        onChange={(e) => handleZipCodeChange(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-xs rounded-xl border border-neutral-200 px-3 py-2.5 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      />
                      {isLAZip && (
                        <span className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-retrofit-blue flex items-center gap-0.5" title="Los Angeles jurisdiction vetted">
                          <BadgeCheck className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase font-mono block mb-1">Grid Utility</label>
                    <select
                      value={property.utility}
                      onChange={(e) => setProperty(prev => ({ ...prev, utility: e.target.value as any }))}
                      className="w-full text-xs rounded-xl border border-neutral-200 px-2.5 py-2.5 focus:border-neutral-900 focus:outline-none leading-tight"
                    >
                      <option value="LADWP">LADWP (Los Angeles)</option>
                      <option value="SCE">SCE (SoCal Edison)</option>
                      <option value="Burbank">BWP (Burbank)</option>
                      <option value="Glendale">GWP (Glendale)</option>
                      <option value="Pasadena">PWP (Pasadena)</option>
                      <option value="PG_AND_E">PG&E (Northern CA)</option>
                      <option value="SDG_AND_E">SDG&E (San Diego)</option>
                    </select>
                  </div>
                </div>

                {/* Checklist / Toggles zone */}
                <div className="space-y-3 pt-3 border-t border-neutral-100">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={property.isDAC}
                      onChange={(e) => setProperty(prev => ({ ...prev, isDAC: e.target.checked }))}
                      className="rounded border-neutral-300 text-retrofit-blue focus:ring-retrofit-blue h-4.5 w-4.5 mt-0.5"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-bold text-neutral-800">Disadvantaged Community (DAC)</span>
                      <p className="text-neutral-450 mt-0.5">Vetted under CalEnviroScreen 4.0. Unlocks SOMAH Solar & CEC Decarb funding.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={property.hasTaxLiability}
                      onChange={(e) => setProperty(prev => ({ ...prev, hasTaxLiability: e.target.checked }))}
                      className="rounded border-neutral-300 text-retrofit-blue focus:ring-retrofit-blue h-4.5 w-4.5 mt-0.5"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-bold text-neutral-800">Verify Private Tax-Exempt Status</span>
                      <p className="text-neutral-450 mt-0.5">Enables IRA Section 25C filings. Turn off for "Direct Refund Pay" for nonprofits.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={property.isEquityRegion}
                      onChange={(e) => setProperty(prev => ({ ...prev, isEquityRegion: e.target.checked }))}
                      className="rounded border-neutral-300 text-retrofit-blue focus:ring-retrofit-blue h-4.5 w-4.5 mt-0.5"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-bold text-neutral-800">CalSGIP Equity Resilience Buffer</span>
                      <p className="text-neutral-450 mt-0.5">Triggers premium batteries incentive offsets ($850/kWh) in high wildfire hazard grids.</p>
                    </div>
                  </label>
                </div>

              </div>
            </div>

            {/* AI Advisor Chat Panel */}
            <IncentiveAdvisor property={property} calculations={calculations} />

          </div>

          {/* COLUMN 2: SUMMARY BOARD & CHARTS & RETROFIT LIST (Column span 7) */}
          <div className="lg:col-span-7 space-y-8 animate-fade-in">
            
            {/* Visual Capital Summary Cards Block */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-xs">
                <p className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider font-mono">Gross Estimate</p>
                <p className="text-md font-bold font-mono text-neutral-900 mt-1">${summary.grossCost.toLocaleString()}</p>
                <span className="text-[9px] text-neutral-400 font-medium">Full equipment outlay</span>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-xs">
                <p className="text-[9px] uppercase font-bold text-retrofit-blue tracking-wider font-mono">Direct Rebates</p>
                <p className="text-md font-bold font-mono text-retrofit-blue mt-1">-${summary.totalRebates.toLocaleString()}</p>
                <span className="text-[9px] text-neutral-400 font-medium">Upfront point-of-sale grants</span>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-xs">
                <p className="text-[9px] uppercase font-bold text-teal-650 tracking-wider font-mono">Tax / Cash Refunds</p>
                <p className="text-md font-bold font-mono text-teal-700 mt-1">-${summary.totalCredits.toLocaleString()}</p>
                <span className="text-[9px] text-neutral-400 font-medium">Claimed / Refused direct pay</span>
              </div>

              <div className="bg-retrofit-blue text-white rounded-2xl p-4 shadow-md border border-retrofit-dark relative overflow-hidden">
                <div className="absolute right-[-10px] top-[-10px] opacity-10">
                  <ShieldCheck className="h-16 w-16" />
                </div>
                <p className="text-[9px] uppercase font-bold text-retrofit-green tracking-wider font-mono">Final Net CapEx</p>
                <p className="text-md font-bold font-mono text-white mt-1">${summary.netCost.toLocaleString()}</p>
                <span className="text-[9px] text-zinc-250 font-semibold leading-tight">Total net project cost</span>
              </div>
              
            </div>

            {/* Interactive Stacked Chart styled for Retrofit.LA */}
            <InteractiveChart calculations={calculations} summary={summary} />

            {/* Upgrade Catalog checklist */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#021230] uppercase tracking-widest flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-retrofit-blue" /> Decarbonization Catalog
              </h3>

              <div className="space-y-3">
                {calculations.map(calc => renderUpgradeRow(calc))}
              </div>
            </div>

            {/* Saved Scenario Persistent Workspace */}
            <SavedScenarios
              currentProperty={property}
              currentItems={upgradesState}
              onLoadScenario={handleLoadScenario}
            />

          </div>

        </div>

        {/* Technical Footer */}
        <footer className="mt-16 md:mt-24 pt-8 border-t border-neutral-200 text-center text-xs text-neutral-400 leading-relaxed font-semibold space-y-2">
          <p>
            LA Retrofit Incentive Stacking Engine compiles calculations based on the Inflation Reduction Act of 2022 (Section 25C, 25D, 30C), CPUC California SGIP budgetary regulations (2024-2026), TECH Clean California space and water heating policies, and official LADWP Charge Up LA / Energy Star schedules.
          </p>
          <p className="font-extrabold text-[#021230]">
            © {new Date().getFullYear()} Retrofit LA / Sustento. All rights reserved. Vetted by clean engineering.
          </p>
        </footer>

      </div>
    </div>
  );
}
