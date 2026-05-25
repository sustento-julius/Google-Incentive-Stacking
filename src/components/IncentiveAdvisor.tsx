/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PropertyConfig, UpgradeCalculation, ChatMessage } from '../types';
import { Sparkles, Send, Trash2, HelpCircle, Loader2, MessageSquare, Bot, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface IncentiveAdvisorProps {
  property: PropertyConfig;
  calculations: UpgradeCalculation[];
}

const SAMPLE_PROMPTS = [
  {
    title: 'TECH Clean Code',
    text: 'What are the technical requirements to claim CA TECH Clean rebates for heat pumps?',
  },
  {
    title: 'Credit Stacking',
    text: 'Explain the rules for stacking HEEHRA electrification rebates with 25C federal tax credits.',
  },
  {
    title: 'NEM 3.0 & Virtual Solar',
    text: 'For a multifamily property, how do we structure Solar and Batteries under CA NEM 3.0?',
  },
  {
    title: 'SGIP Free Batteries?',
    text: 'How do I satisfy the requirements for CA SGIP Equity Resilience 100% covered battery budget?',
  }
];

export default function IncentiveAdvisor({ property, calculations }: IncentiveAdvisorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle message submission
  const sendMessage = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    setApiError(null);
    const userMsg: ChatMessage = {
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      // Send parameters to server API
      // Standardize selections for prompt
      const selectedCalculations = calculations.filter(c => c.baseCost > 0);

      const response = await fetch('/api/retrofit-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property,
          selectedUpgrades: selectedCalculations,
          chatHistory: newHistory,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server responded with an execution failure.');
      }

      const resData = await response.json();
      
      const modelMsg: ChatMessage = {
        role: 'model',
        content: resData.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (e: any) {
      console.error('Advisor feedback fetch failed:', e);
      setApiError(e.message || 'Unable to establish server-side Gemini link. Ensure developers configured GEMINI_API_KEY correctly.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setApiError(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col h-[600px] overflow-hidden">
      {/* Advisor Header */}
      <div className="bg-neutral-900 text-white p-5 flex items-center justify-between shadow-sm border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600 rounded-xl text-emerald-50 shadow-md">
            <Sparkles className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-sans tracking-wide uppercase">AI Electrification Advisor</h3>
            <p className="text-[10px] text-neutral-400 font-medium">
              Stretching retrofits capital using official California & Federal policies
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-850 transition duration-150 cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-5">
            <div className="h-12 w-12 bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 text-neutral-400">
              <Bot className="h-6 w-6" />
            </div>
            
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-widest">
                Decarbonization Feasibility Planner
              </h4>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Let Gemini help analyze your building retrofits, audit equipment specs, optimize tax timing, and walk you through California utility program guidelines.
              </p>
            </div>

            {/* Starter Sample Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg pt-2">
              {SAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="p-3 bg-white hover:bg-neutral-50 text-left border border-neutral-200 rounded-xl transition duration-150 text-[11px] leading-snug text-neutral-600 hover:border-neutral-300 font-medium cursor-pointer flex flex-col justify-between group h-24 shadow-sm"
                >
                  <span className="font-bold text-neutral-800 group-hover:text-emerald-700 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 shrink-0" /> {prompt.title}
                  </span>
                  <span className="line-clamp-2 text-neutral-400 text-[10px] mt-1 font-normal leading-normal">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isModel = msg.role === 'model';
              return (
                <div
                  key={i}
                  className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm border ${
                      isModel
                        ? 'bg-white text-neutral-800 border-neutral-200/80 rounded-tl-none'
                        : 'bg-neutral-900 text-neutral-50 border-neutral-800 rounded-tr-none font-medium'
                    }`}
                  >
                    {/* Role Header */}
                    <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] uppercase font-bold tracking-wider ${
                      isModel ? 'text-emerald-700' : 'text-neutral-400'
                    }`}>
                      {isModel ? (
                        <>
                          <Bot className="h-3.5 w-3.5 shrink-0" /> Decarbonization Planner
                        </>
                      ) : (
                        'Property Owner'
                      )}
                    </div>

                    {/* Markdown rendering formatting lines */}
                    <div className="space-y-2 whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    <div className={`text-[9px] text-right mt-1.5 ${isModel ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white border border-neutral-200 text-neutral-600 rounded-2xl rounded-tl-none p-4 w-[65%] text-xs shadow-sm flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 text-emerald-600 animate-spin shrink-0" />
                  <span className="text-[11px] font-medium text-neutral-500 font-sans">
                    Consulting policy frameworks...
                  </span>
                </div>
              </div>
            )}

            {apiError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2.5 text-xs text-red-800 leading-tight">
                <AlertTriangle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Gemini Connection Offline</p>
                  <p className="text-[10px] text-red-700 mt-1">{apiError}</p>
                </div>
              </div>
            )}
            
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input Submit Area */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputValue);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder={
              isLoading 
                ? 'Engaging electrification logic...' 
                : 'Ask about rebates, NEM 3.0 virtual metering, pre-approvals...'
            }
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-xs focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="rounded-xl bg-neutral-900 px-4.5 py-3 text-emerald-50 hover:bg-neutral-850 focus:outline-none transition shrink-0 disabled:bg-neutral-100 disabled:text-neutral-400 cursor-pointer flex items-center justify-center shadow"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
