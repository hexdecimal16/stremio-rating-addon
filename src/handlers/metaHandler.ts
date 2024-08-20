import { scrapeRatings } from '../utils/ratingScrapers';

export async function handleMetaRequest(id: string, type: string) {
    console.log('Handling meta request for:', id, type);
    return scrapeRatings(id, type);
}
