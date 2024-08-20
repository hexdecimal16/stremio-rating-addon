import axios from 'axios';
import { scrapeRatings } from '../utils/ratingScrapers';
import { CINEMETA_BASE_URL, CINEMETA_CATALOG_URL } from '../constants/urls';

async function fetchCatalog(url: string): Promise<any> {
    const response = await axios.get(url);
    response.data.metas = await Promise.all(response.data.metas.map(async (meta: any) => {
        return scrapeRatings(meta.id, meta.type);
    }));
    return response.data;
}

export async function trendingCatalog(type: string, extra: any): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/top/catalog/${type}/top/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url);
}

export async function featuredCataloge(type: string, extra: any): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/imdbRating/catalog/${type}/imdbRating/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url);
}

export async function searchCatalog(type: string, extra: any): Promise<any> {
    const url = `${CINEMETA_BASE_URL}/catalog/${type}/search=${extra.search || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url);
}

export async function bestYearByYearCatalog(type: string, extra: any): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/year/catalog/${type}/year/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url);
}