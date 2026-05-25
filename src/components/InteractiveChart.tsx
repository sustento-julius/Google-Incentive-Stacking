/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeCalculation, TotalSummary } from '../types';
import { TrendingDown, HelpCircle, Info, Sparkles, Receipt, CheckCircle, Leaf, Zap } from 'lucide-react';

interface InteractiveChartProps {
  calculations: UpgradeCalculation[];
  summary: TotalSummary;
}

export default function InteractiveChart({ calculations, summary }: InteractiveChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const activeCalcs = calculations.filter(c => c.baseCost > 0);
  const totalIncentives = summary.totalRebates + summary.totalCredits;
  const incentivePercentage = summary.grossCost > 0 ? (totalIncentives / summary.grossCost) * 100 : 0;

  // Compile detailed breakdowns of direct categories
  const sourceBreakdown = {
    utility: 0,
    state: 0,
    heehra: 0,
    tax: 0,
  };

  activeCalcs.forEach(c => {
    c.applicableIncentives.forEach(inc => {
      if (inc.type === 'utility_rebate') sourceBreakdown.utility += inc.amount;
      else if (inc.type === 'state_rebate') sourceBreakdown.state += inc.amount;
      else if (inc.type === 'federal_rebate') sourceBreakdown.heehra += inc.amount;
      else if (inc.type === 'federal_tax_credit') sourceBreakdown.tax += inc.amount;
    });
  });

  // Calculate simple ROI break-even periods:
  // Base Payback (without incentives): Gross Cost / Annual Savings
  // Stacked Payback (with incentives): Net Cost / Annual Savings
  const baselinePaybackYears = summary.totalAnnualSavings > 0 
    ? (summary.grossCost / summary.totalAnnualSavings).toFixed(1)
    : '0';

  const stackedPaybackYears = summary.totalAnnualSavings > 0 
    ? (summary.netCost / summary.totalAnnualSavings).toFixed(1)
    : '0';

  // Environmental equivalents
  // 1 ton of CO2 is 2000 lbs.
  // 1 tree absorbs ~48 lbs of CO2 per year. Our savings are annual.
  const treesPlantedEquivalent = Math.round(summary.totalCO2Savings / 48);
  const gasolineGallonsEquivalent = Math.round(summary.totalCO2Savings / 19.6);

  // Stack segment styling and properties for interactive bar
  const segments = [
    {
      id: 'net_cost',
      name: 'Net Capital Cost',
      amount: summary.netCost,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-500',
      desc: 'The remaining out-of-pocket investment required by the building owner.',
    },
    {
      id: 'utility',
      name: 'Local Utility Rebates',
      amount: sourceBreakdown.utility,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-500',
      desc: 'Cash-back discounts paid directly by LADWP, SCE, or your regional utility company.',
    },
    {
      id: 'state',
      name: 'California State Programs',
      amount: sourceBreakdown.state,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      desc: 'Subsidies from California state agencies, including TECH Clean CA and SOMAH solar grants.',
    },
    {
      id: 'heehra',
      name: 'Federal electrification (HEEHRA)',
      amount: sourceBreakdown.heehra,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-500',
      desc: 'Direct point-of-sale federal electrification discounts targeting low and moderate income households.',
    },
    {
      id: 'tax',
      name: 'IRA Federal Tax Credits',
      amount: sourceBreakdown.tax,
      color: 'bg-teal-500',
      textColor: 'text-teal-500',
      desc: 'Non-refundable tax liability deductions claimed during annual tax filing (Sections 25C, 25D, 30C).',
    },
  ];

  // Only render segments with values
  const activeSegments = segments.filter(seg => seg.amount > 0);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 uppercase tracking-wider">
            Financial & Impact Analytics
          </span>
          <h2 className="text-2xl font-bold font-sans text-neutral-900 mt-2">Stacked Upgrade Breakdown</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Analyzing stack efficiency, payback velocity, and cumulative carbon reductions.
          </p>
        </div>

        {summary.grossCost > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50/70 py-2 px-4 rounded-xl border border-emerald-100">
            <TrendingDown className="h-5 w-5 text-emerald-600 animate-pulse" />
            <div>
              <p className="text-xs text-neutral-500 leading-tight">Incentives Cover</p>
              <p className="text-lg font-bold text-emerald-700 font-mono">
                {incentivePercentage.toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {summary.grossCost === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-neutral-50 border border-dashed border-neutral-200">
          <HelpCircle className="h-10 w-10 text-neutral-300" />
          <h3 className="text-sm font-semibold text-neutral-700 mt-3">No Upgrades Selected</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            Toggle on upgrades in the catalog to calculate stacked cost models and payback projections.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Section 1: Stack Visual Bar (Column span 7) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600" /> Stacked Capital Offset
              </h3>
              
              {/* Stack Segment Indicator */}
              <div className="space-y-6">
                
                {/* Visual Bar Segment */}
                <div className="relative">
                  <div className="h-10 w-full bg-neutral-100 rounded-xl overflow-hidden flex shadow-sm border border-neutral-200">
                    {activeSegments.map((seg) => {
                      const share = (seg.amount / summary.grossCost) * 100;
                      return (
                        <button
                          key={seg.id}
                          style={{ width: `${share}%` }}
                          className={`${seg.color} h-full transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer ${
                            hoveredSegment === seg.id ? 'opacity-90 scale-y-105' : 'opacity-100'
                          }`}
                          onMouseEnter={() => setHoveredSegment(seg.id)}
                          onMouseLeave={() => setHoveredSegment(null)}
                          onClick={() => setHoveredSegment(hoveredSegment === seg.id ? null : seg.id)}
                          aria-label={`${seg.name}: $${seg.amount.toLocaleString()}`}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Quick Scale indicators */}
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400 mt-1.5 px-1">
                    <span>$0 Baseline</span>
                    <span>$${Math.round(summary.grossCost / 2).toLocaleString()}</span>
                    <span>$${summary.grossCost.toLocaleString()} Gross</span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                  {segments.map((seg) => {
                    const hasAmount = seg.amount > 0;
                    return (
                      <div
                        key={seg.id}
                        className={`p-3 rounded-xl border transition-all duration-200 cursor-help ${
                          !hasAmount ? 'opacity-45 border-neutral-200' :
                          hoveredSegment === seg.id
                            ? 'bg-neutral-50/90 border-neutral-400 shadow-sm'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                        onMouseEnter={() => hasAmount && setHoveredSegment(seg.id)}
                        onMouseLeave={() => hasAmount && setHoveredSegment(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                          <span className="text-xs font-semibold text-neutral-700">{seg.name}</span>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-sm font-bold font-mono text-neutral-900">
                            ${seg.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                          {hasAmount && (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ({((seg.amount / summary.grossCost) * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Info Display Box */}
                <div className="h-20 bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 flex items-start gap-2.5 overflow-hidden">
                  <Info className="h-4.5 w-4.5 text-neutral-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-neutral-600">
                    <AnimatePresence mode="wait">
                      {hoveredSegment ? (
                        <motion.div
                          key={hoveredSegment}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                        >
                          <span className="font-bold text-neutral-800">
                            {segments.find(s => s.id === hoveredSegment)?.name}:
                          </span>{' '}
                          {segments.find(s => s.id === hoveredSegment)?.desc}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="default"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15 }}
                        >
                          <span className="font-bold text-neutral-800">Pro-Tip:</span> Hover over individual legend boxes or segments on the bar to explore funding distribution details, payout methodologies, and program terms.
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Section 2: Financial Stats Table (Column span 5) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            
            {/* Payback Comparison Widget */}
            <div className="bg-neutral-50/80 p-5 rounded-2xl border border-neutral-200/80">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-emerald-600" /> Investment Velocity (ROI)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span>Payback without Stacking</span>
                    <span className="font-mono font-medium">{baselinePaybackYears} Years</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div className="bg-neutral-400 h-full rounded-full" style={{ width: `${Math.min(100, Number(baselinePaybackYears) * 5)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-800 font-bold mb-1">
                    <span>Payback with Incentives</span>
                    <span className="font-mono text-emerald-700">{stackedPaybackYears} Years</span>
                  </div>
                  <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, Number(stackedPaybackYears) * 5)}%` }} />
                  </div>
                </div>

                <div className="text-[11px] text-neutral-500 leading-normal bg-white p-2.5 rounded-lg border border-neutral-200/60 mt-1">
                  Stacking incentives reduces the investment break-even duration of your upgrades list by{' '}
                  <span className="font-bold text-emerald-700">
                    {Number(baselinePaybackYears) > 0 ? (((Number(baselinePaybackYears) - Number(stackedPaybackYears)) / Number(baselinePaybackYears)) * 100).toFixed(0) : '0'}%
                  </span>
                  , saving <span className="font-bold text-neutral-800 font-mono">${summary.totalAnnualSavings.toLocaleString()}/year</span> in utility charges.
                </div>
              </div>
            </div>

            {/* Environmental Impact Metrics */}
            <div className="bg-emerald-950 text-emerald-50 p-5 rounded-2xl border border-emerald-900 shadow-sm relative overflow-hidden">
              <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                <Leaf className="h-32 w-32" />
              </div>
              
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3 flex items-center gap-1.5">
                <Leaf className="h-4 w-4" /> Lifetime Ecosystem Impact
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-900/55 p-3 rounded-xl border border-emerald-800/40">
                  <p className="text-[10px] text-emerald-300 leading-tight uppercase font-medium tracking-wide">Carbon Avoided</p>
                  <p className="text-md font-bold font-mono mt-1 text-white leading-none">
                    {summary.totalCO2Savings.toLocaleString()} <span className="text-xs font-sans font-normal">lbs/yr</span>
                  </p>
                </div>

                <div className="bg-emerald-900/55 p-3 rounded-xl border border-emerald-800/40">
                  <p className="text-[10px] text-emerald-300 leading-tight uppercase font-medium tracking-wide">Forest Equivalent</p>
                  <p className="text-md font-bold mt-1 text-white leading-none">
                    {treesPlantedEquivalent} <span className="text-xs font-normal text-emerald-300 font-sans">Trees</span>
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-emerald-400 mt-4 leading-normal">
                Equivalent to removing approximately <span className="font-bold text-emerald-200 font-mono">{gasolineGallonsEquivalent.toLocaleString()} Gallons</span> of gasoline combustion per year. Energy upgrades reduce physical carbon footprints immediately.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
