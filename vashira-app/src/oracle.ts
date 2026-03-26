/**
 * Vashira 5.0 - The Oracle
 * Responsible for context assembly and LLM orchestration.
 */

export interface OracleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

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

  // 3. Generation (Standard OpenAI-compatible payload)
  try {
    const response = await fetch(`\${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer \${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    console.error("[Oracle] Transmission failure:", e);
    throw e;
  }
}
