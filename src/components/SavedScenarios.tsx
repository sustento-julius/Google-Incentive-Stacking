/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PropertyConfig, UpgradeCategory, Scenario } from '../types';
import { calculateIncentives, calculateSummary } from '../utils';
import { Bookmark, Clipboard, Plus, Trash2, Check, RefreshCw, FolderOpen, ArrowRight, Table } from 'lucide-react';

interface SavedScenariosProps {
  currentProperty: PropertyConfig;
  currentItems: Record<UpgradeCategory, { selected: boolean; unitCost: number; multiplier: number }>;
  onLoadScenario: (scenario: Scenario) => void;
}

export default function SavedScenarios({ currentProperty, currentItems, onLoadScenario }: SavedScenariosProps) {
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load saved from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('retrofit_la_scenarios');
      if (raw) {
        setSavedScenarios(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Failed reading scenarios', e);
    }
  }, []);

  const saveToLocalStorage = (list: Scenario[]) => {
    try {
      localStorage.setItem('retrofit_la_scenarios', JSON.stringify(list));
      setSavedScenarios(list);
    } catch (e) {
      console.error('Failed writing scenarios', e);
    }
  };

  const handleSaveScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    // Create a clone of active configuration
    const itemsStateClone: Record<UpgradeCategory, { unitCost: number; multiplier: number }> = {} as any;
    const selectedUpgradeIds: UpgradeCategory[] = [];

    (Object.keys(currentItems) as UpgradeCategory[]).forEach(catId => {
      itemsStateClone[catId] = {
        unitCost: currentItems[catId].unitCost,
        multiplier: currentItems[catId].multiplier,
      };
      if (currentItems[catId].selected) {
        selectedUpgradeIds.push(catId);
      }
    });

    const newScenario: Scenario = {
      id: 'sc_' + Date.now(),
      name: newScenarioName.trim(),
      createdAt: new Date().toISOString(),
      property: { ...currentProperty },
      selectedUpgradeIds,
      itemsState: itemsStateClone,
    };

    const updated = [newScenario, ...savedScenarios];
    saveToLocalStorage(updated);
    setNewScenarioName('');
  };

  const handleDeleteScenario = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedScenarios.filter(sc => sc.id !== id);
    saveToLocalStorage(updated);
    setSelectedForCompare(prev => prev.filter(pId => pId !== id));
  };

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      }
      if (prev.length >= 3) {
        // Limit to comparing 3 scenarios max
        alert("You can compare up to 3 scenarios simultaneously.");
        return prev;
      }
      return [...prev, id];
    });
  };

  // Helper: Calculate short summary metrics for a saved scenario row
  const getScenarioMetrics = (sc: Scenario) => {
    const calcObj: Record<UpgradeCategory, { selected: boolean; unitCost: number; multiplier: number }> = {} as any;
    
    (Object.keys(sc.itemsState) as UpgradeCategory[]).forEach(catId => {
      calcObj[catId] = {
        selected: sc.selectedUpgradeIds.includes(catId),
        unitCost: sc.itemsState[catId].unitCost,
        multiplier: sc.itemsState[catId].multiplier,
      };
    });

    const calcs = calculateIncentives(sc.property, calcObj);
    const summary = calculateSummary(calcs);
    return { summary, selectedCount: sc.selectedUpgradeIds.length };
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 uppercase tracking-wider">
            Workspace Persistence
          </span>
          <h2 className="text-xl font-bold text-neutral-900 mt-2 flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-emerald-600" /> Scenario Scenario Manager
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Compare and archive different building retrofit configurations.
          </p>
        </div>
      </div>

      {/* Save form */}
      <form onSubmit={handleSaveScenario} className="flex gap-2 max-w-md mb-6">
        <input
          type="text"
          value={newScenarioName}
          onChange={(e) => setNewScenarioName(e.target.value)}
          placeholder="e.g., 12-Unit Building Heat Pump Pack"
          maxLength={45}
          className="flex-1 rounded-xl border border-neutral-200/80 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Save Scenario
        </button>
      </form>

      {savedScenarios.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-xl p-6 text-center bg-neutral-50/50">
          <FolderOpen className="h-8 w-8 text-neutral-300 mx-auto" />
          <h3 className="text-xs font-bold text-neutral-600 mt-2">No Archived Scenarios</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Type a name above to save your property credentials and active configuration.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-neutral-200/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium font-sans">
                  <th className="p-3.5 w-[5%] text-center">Compare</th>
                  <th className="p-3.5">Scenario Name</th>
                  <th className="p-3.5 text-center">Housing Type</th>
                  <th className="p-3.5 text-center">Specs</th>
                  <th className="p-3.5 text-right font-mono">Gross Cost</th>
                  <th className="p-3.5 text-right font-mono text-emerald-700">Net Cost</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {savedScenarios.map((sc) => {
                  const { summary, selectedCount } = getScenarioMetrics(sc);
                  const isChecked = selectedForCompare.includes(sc.id);

                  return (
                    <tr
                      key={sc.id}
                      className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                      onClick={() => onLoadScenario(sc)}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleCompare(sc.id, e as any)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-semibold text-neutral-800">
                        <div>
                          {sc.name}
                          <p className="text-[10px] text-neutral-400 font-normal mt-0.5">
                            Saved {new Date(sc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${
                          sc.property.type === 'noah'
                            ? 'bg-amber-50 text-amber-800 border border-amber-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {sc.property.type === 'noah' ? 'NOAH' : 'Nonprofit'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-neutral-500">
                        {sc.property.unitsCount} unit{sc.property.unitsCount > 1 ? 's' : ''} • {selectedCount} system{selectedCount !== 1 ? 's' : ''}
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium text-neutral-500">
                        ${summary.grossCost.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                        ${summary.netCost.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onLoadScenario(sc)}
                            className="bg-neutral-100 hover:bg-neutral-200/80 px-2.5 py-1 rounded text-[11px] font-semibold text-neutral-700 transition flex items-center gap-1 cursor-pointer"
                            title="Load active variables"
                          >
                            Load <ArrowRight className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteScenario(sc.id, e)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition duration-150 cursor-pointer"
                            title="Delete scenario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-xl border border-neutral-200/50 mt-4">
            <div className="text-xs text-neutral-500 leading-normal">
              Select <span className="font-bold text-neutral-700">up to 3 scenarios</span> using the checkboxes on the left to activate side-by-side comparative modeling charts.
            </div>
            {selectedForCompare.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareMode(!compareMode)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs px-4 py-2 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer shadow-sm"
              >
                <Table className="h-4 w-4" /> {compareMode ? 'Close Matrix' : `Compare Selected (${selectedForCompare.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* COMPARATIVE MATRIX MODAL */}
      {compareMode && selectedForCompare.length > 0 && (
        <div className="mt-6 border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50/50">
          <div className="bg-neutral-800 text-white p-4 flex justify-between items-center">
            <h3 className="text-sm font-bold font-sans flex items-center gap-1.5 uppercase tracking-wide">
              <Table className="h-4 w-4" /> Scenario Comparative Matrix
            </h3>
            <button
              onClick={() => setCompareMode(false)}
              className="text-neutral-400 hover:text-white text-xs font-semibold px-2 py-1 rounded hover:bg-neutral-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedForCompare.map(scId => {
              const sc = savedScenarios.find(s => s.id === scId);
              if (!sc) return null;
              const { summary, selectedCount } = getScenarioMetrics(sc);

              return (
                <div key={scId} className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase uppercase-wider">
                        {sc.property.type === 'noah' ? 'NOAH' : 'Nonprofit'}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {sc.property.unitsCount} Units
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-850 truncate">{sc.name}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Utility Provider: {sc.property.utility}</p>
                    
                    <div className="space-y-2 mt-4 border-t border-neutral-100 pt-3">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-neutral-500">Gross Estimate:</span>
                        <span className="font-mono font-semibold text-neutral-700">${summary.grossCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-neutral-500">Direct Cash Rebates:</span>
                        <span className="font-mono text-indigo-600 font-semibold">-${summary.totalRebates.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-neutral-500">Tax Year Credits:</span>
                        <span className="font-mono text-teal-600 font-semibold">-${summary.totalCredits.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs border-t border-dashed border-neutral-100 pt-2">
                        <span className="font-semibold text-neutral-800">Final Net CapEx:</span>
                        <span className="font-mono font-bold text-lg text-emerald-700">${summary.netCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/50 mt-4 text-[10px] space-y-1">
                    <div className="flex justify-between text-neutral-500">
                      <span>Annual Bill Reductions:</span>
                      <span className="font-bold text-neutral-700">${summary.totalAnnualSavings.toLocaleString()}/yr</span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>Carbon Cutbacks:</span>
                      <span className="font-bold text-emerald-700">{summary.totalCO2Savings.toLocaleString()} lbs/yr</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
