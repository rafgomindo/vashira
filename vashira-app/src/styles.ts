import axios from 'axios';
import fs from 'fs';
import path from 'path';

const STYLES_REPO = 'https://raw.githubusercontent.com/citation-style-language/styles/master';

export class StyleStore {
  private cacheDir: string;

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'csl_styles');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public async getStyleXml(styleName: string): Promise<string> {
    const localPath = path.join(this.cacheDir, `${styleName}.csl`);
    
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf8');
    }

    try {
      const response = await axios.get(`${STYLES_REPO}/${styleName}.csl`);
      fs.writeFileSync(localPath, response.data);
      return response.data;
    } catch (e) {
      console.error(`[StyleStore] Failed to fetch style: ${styleName}`, e);
      throw new Error(`Style ${styleName} not found in repository mastery.`);
    }
  }

  public listCachedStyles(): string[] {
    return fs.readdirSync(this.cacheDir).map(f => f.replace('.csl', ''));
  }
}
