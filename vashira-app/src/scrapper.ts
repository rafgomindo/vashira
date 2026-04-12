import fs from 'node:fs';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';

export interface ScrapedConnections {
    zoteroKeys: string[];
    gefyraTools: string[];
    vashiraItems: string[];
}

/**
 * Scrapes a .docx file for various citation and tool patterns.
 * 
 * Patterns:
 * - Zotero: [@citekey]
 * - Gefyra Tool: [[ToolName]]
 * - Vashira: vashira-cite:ID (via Content Controls XML)
 */
export async function scrapeDocx(filePath: string): Promise<ScrapedConnections> {
    const results: ScrapedConnections = {
        zoteroKeys: [],
        gefyraTools: [],
        vashiraItems: []
    };

    if (!fs.existsSync(filePath)) return results;

    try {
        // 1. Extract Text for Regex patterns (Zotero & Gefyra)
        const { value: text } = await mammoth.extractRawText({ path: filePath });
        
        // Zotero Keys: [@citekey]
        const zoteroRegex = /\[@([^\]\s,;]+)\]/g;
        let match;
        while ((match = zoteroRegex.exec(text)) !== null) {
            if (!results.zoteroKeys.includes(match[1])) {
                results.zoteroKeys.push(match[1]);
            }
        }

        // Gefyra Tools: [[ToolName]]
        const gefyraRegex = /\[\[([^\]\s]+)\]\]/g;
        while ((match = gefyraRegex.exec(text)) !== null) {
            if (!results.gefyraTools.includes(match[1])) {
                results.gefyraTools.push(match[1]);
            }
        }

        // 2. Extract XML for Vashira Content Controls
        const zip = new AdmZip(filePath);
        const docXml = zip.readAsText("word/document.xml");
        
        // Vashira Content Controls use <w:tag w:val="vashira-cite:ID"/>
        // We look for vashira-cite:\d+
        const vashiraRegex = /vashira-cite:(\d+)/g;
        while ((match = vashiraRegex.exec(docXml)) !== null) {
            if (!results.vashiraItems.includes(match[1])) {
                results.vashiraItems.push(match[1]);
            }
        }

    } catch (error) {
        console.error('[Scraper] Error parsing docx:', error);
    }

    return results;
}
