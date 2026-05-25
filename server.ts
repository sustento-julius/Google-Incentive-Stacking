/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON parsing for requests
  app.use(express.json());

  // 1. API ROUTES (Must go FIRST)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/retrofit-advisor', async (req, res) => {
    try {
      const { property, selectedUpgrades, chatHistory } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY environment variable is not configured. Please add it via the Settings > Secrets menu.'
        });
      }

      // Initialize GoogleGenAI client with required User-Agent
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Formulate a clean summary of the active building state
      const propertySummary = `
PROPERTY PROFILE:
- Property Profile Category: ${property.type === 'noah' ? 'Naturally Occurring Affordable Housing (NOAH) - Unsubsidized private affordable rents' : 'Nonprofit Affordable Housing - Deed-Restricted community block'}
- Residential Units Count: ${property.unitsCount} units (Sweet spot 5-49 unit segment for middle-market LA housing)
- Zip Code: ${property.zipCode}
- Utility Provider: ${property.utility}
- Low-Income Tenant Ratio: ${property.percentTenantsLMI}% of tenants under low-income thresholds
- Disadvantaged Community (DAC) Status: ${property.isDAC ? 'Yes (Qualifies for SOMAH bonus, LADWP CAMR, CEC EBD direct install)' : 'No'}
- Federal Tax Liability: ${property.hasTaxLiability ? 'Yes (Can claim 25C/25D Non-Refundable Credits)' : 'No (Note: Deed-restricted nonprofit organizations can claim 100% of these credits as a direct cash refund / Direct Pay from the IRS under the new IRA Elective Pay regulations!)'}
- CalSGIP Equity Resonance Battery Region: ${property.isEquityRegion ? 'Yes (Qualifies for premium $850/kWh resilience battery storage budgets)' : 'No'}

ACTIVE SELECTIONS IN CALCULATOR REPORT:
${selectedUpgrades && selectedUpgrades.length > 0 
  ? selectedUpgrades.map((u: any) => `- **${u.name}**
  - Total Cost: $${u.baseCost.toLocaleString()}
  - Total Direct Cash Rebates (upfront/discounts): $${u.totalRebates.toLocaleString()}
  - Tax Credits (claimed at filing / direct pay): $${u.totalTaxCredits.toLocaleString()}
  - Net Cost to Owner: $${u.ownerNetCost.toLocaleString()}
  - Projected annual utility bill cuts: $${u.estimatedAnnualSavings.toLocaleString()}/year
  - Annual CO2 reduction: ${u.estimatedCO2Savings.toLocaleString()} lbs`).join('\n')
  : '*(No retrofit upgrade projects currently selected in the calculator)*'
}
      `;

      const systemInstruction = `You are a professional Building Decarbonization and Electrification Consultant specializing in Southern California municipal, state, and Federal energy retrofits (acting as a senior policy engineer at Sustento / Retrofit LA).

Your assignment is to help real-world building owners, Naturally Occurring Affordable Housing (NOAH) landlords, and nonprofit housing organizations organize their building upgrades. Explain how to "stack" federal, state, and local utility rebate funds to lower capital outlays to near $0.

LA Programs to advocate and suggest when relevant:
1. LADWP CAMR (Clean Business & Multifamily Program): For properties in LADWP electric zones with DAC status or >=66% LMI tenants. Covers active equipment, envelope, and solar (averages 45% coverage). Highly recommend reaching out to AEA at CAMRinfo@aea.us.org or lcosta@aeacleanenergy.org.
2. SCE ESA-MFES (Multifamily Energy Savings): Up to 100% direct install coverage for energy-efficiency/weatherization and hot water heat pumps. Requires >=65% LMI for deed-restricted nonprofits and >=80% LMI for private NOAH properties. Point them to SouthernMFES@rhainc.com or SouthernMFES@resource-innovations.com.
3. SCG CoMFI (SoCalGas Comprehensive Multifamily Incentive): Stackable thermal and water-heating incentives (30% up to $2,000 per unit). Contact CoMFI@rhainc.com.
4. SoCalREN Multifamily: Covers 25% of any remaining efficiency balance up to $1,500/unit. Administered by Willdan & The Energy Coalition (multifamily@socalren.org).
5. CEC Equitable Building Decarbonization (EBD): Unlocks up to 80-100% direct install heat pumps and weatherization for heavily burdened properties in DACs with >=66% LMI. Backed by the California Energy Commission (contactus@socalebd.org).
6. CA SOMAH Solar Program: Up to 100% covered virtual net metering (VNEM) solar arrays ($2,500/kW) for deed-restricted properties or projects in DACs with >=60% LMI tenants [administered by GRID Alternatives & AEA, contact@calsomah.org].
7. TECH Clean California: Standard statewide multifamily heat pump HVAC ($1,000/ outdoor unit) and HPWH ($1,500-$3,000/unit) rebates (TECHMF@aea.us.org).
8. Municipal POUs: BWP Burbank ($1,200/HVAC, $1,000/HPWH), GWP Glendale ($1,500/HVAC, Glendale + AQMD joint $8k storage envelope), PWP Pasadena ($1,500/HVAC, active local Solar Pilot up to $4,000).

Strategic Advisor Focus:
- Advocate for direct contact with programmatic representatives (like CAMRinfo@aea.us.org or SouthernMFES@rhainc.com) to initiate upfront energy audits and technical assistance.
- Emphasize the new IRA "Elective Pay" (Direct Pay) rules for nonprofit organizations, allowing them to claim 30% federal clean energy investments (Section 25D, Section 30C) directly as a cash refund check back from the IRS, even with no tax liability.
- Keep responses beautifully structured, scannable, and encouragingly framed around the 5-49 unit middle market. Do not mention file names, database IDs, or internal coding properties. Refer to the calculated numbers in their active scenario directly.`;

      // Structure current chat context
      const formattedHistory = chatHistory && chatHistory.length > 0
        ? chatHistory.map((m: any) => `${m.role === 'user' ? 'Client' : 'Consultant'}: ${m.content}`).join('\n\n')
        : '';

      const lastUserMsg = chatHistory && chatHistory.length > 0
        ? chatHistory[chatHistory.length - 1].content
        : 'Please perform an expert technical briefing based on my active selections.';

      const finalPrompt = `
CURRENT SCENARIO DATA:
${propertySummary}

${formattedHistory ? `CONSULTATION CHAT HISTORY LOG:\n${formattedHistory}\n\nClient's New Inquiry:` : 'Initial Request details:'}
"${lastUserMsg}"

Consultant Strategic Electrification Response:`;

      // Call Gemini 3.5 Flash server-side
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.75,
        }
      });

      res.json({ text: response.text || 'No response generated from the Decarbonization Planner.' });
    } catch (err: any) {
      console.error('Error in /api/retrofit-advisor:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error contact team' });
    }
  });

  // 2. VITE MIDDLEWARE / STATIC ASSETS
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Development fullstack container launched on http://localhost:${PORT}`);
  });
}

startServer();
