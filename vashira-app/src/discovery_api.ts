import axios from 'axios';

/**
 * OpenAlex Mastery Client
 * Interfaces with the OpenAlex API to find research globally.
 */
export async function searchOpenAlex(query: string) {
  try {
    const response = await axios.get(`https://api.openalex.org/works`, {
      params: {
        search: query,
        limit: 10,
        sort: 'relevance'
      }
    });

    return response.data.results.map((work: any) => ({
      title: work.display_name,
      doi: work.doi ? work.doi.replace('https://doi.org/', '') : '',
      authors: work.authorships ? work.authorships.map((a: any) => a.author.display_name).join(', ') : 'Unknown',
      published: work.publication_year ? work.publication_year.toString() : 'N/A',
      itemType: work.type || 'journalArticle',
      abstract: work.abstract_inverted_index ? 'Abstract available' : ''
    }));
  } catch (error) {
    console.error('OpenAlex Discovery failed:', error);
    return [];
  }
}
