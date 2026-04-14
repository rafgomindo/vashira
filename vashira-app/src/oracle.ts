/**
 * Vashira 5.0 - The Oracle
 * Responsible for context assembly and LLM orchestration.
 */

export interface OracleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: 'openai' | 'anthropic' | 'google';
}

export const ORACLE_TEMPLATES = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  antropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
  local: { baseUrl: 'http://localhost:11434/v1', model: 'llama3' }
};

export async function askTheOracle(query: string, config: OracleConfig, vashiraAPI: any) {
  if (!config.apiKey || !config.baseUrl) {
    throw new Error("Oracle connectivity not established. Please configure API keys.");
  }

  // 1. Retrieval: Get top context from Deep Search
  const searchResults = await vashiraAPI.searchDeep(query);
  const context = searchResults.slice(0, 3).map((r: any) => 
    `TITLE: \${r.title}\nAUTHORS: \${r.authors}\nCONTENT: \${r.content?.substring(0, 1000)}`
  ).join("\n\n---\n\n");

  // 2. Augmentation: Build System Prompt
  const systemPrompt = `You are The Vashira Oracle. Use the following library context to answer the user research query.
Be clinical, evidence-based, and cite the studies mentioned in the context.

CONTEXT FROM USER HUB:
\${context}
`;

  // 3. Generation (Handle different provider formats)
  try {
    let url = `${config.baseUrl}/chat/completions`;
    let headers: any = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    };

    // Special handling for Anthropic/Google if using direct APIs
    if (config.baseUrl.includes('anthropic.com')) {
       url = `https://api.anthropic.com/v1/messages`;
       headers = {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01"
       };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`Oracle Error \${response.status}: \${err}`);
    }

    const data = await response.json();
    return data.choices ? data.choices[0].message.content : data.content[0].text;
  } catch (e) {
    console.error("[Oracle] Transmission failure:", e);
    throw e;
  }
}

export async function checkConnectivity(config: OracleConfig) {
  try {
     // Simple ping to the base URL or models endpoint
     const response = await fetch(`\${config.baseUrl}/models`, {
        headers: { "Authorization": `Bearer \${config.apiKey}` }
     });
     return response.ok;
  } catch (e) {
     return false;
  }
}
