import { DEFAULT_PROVIDERS } from '../constants/costants';
import { scrapeRatings } from '../utils/ratingScrapers';

export async function handleMetaRequest({ id, type, extra, config }: any) {
    let providers = DEFAULT_PROVIDERS;
    if (config && config.providers) {
        providers = config.providers;
    }
    console.log('Handling meta request for:', id, type);
    return scrapeRatings(id, type, providers);
}
