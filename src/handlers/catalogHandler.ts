import axios from 'axios';
import { getRatingsfromDB, scrapeRatings } from '../utils/ratingScrapers';
import { CINEMETA_BASE_URL, CINEMETA_CATALOG_URL } from '../constants/urls';
import { DEFAULT_PROVIDERS } from '../constants/costants';
import { isDatabaseConnected } from '../repository';
import { getContext } from '../context';

async function fetchCatalog(url: string, providers: string[]): Promise<any> {
    const response = await axios.get(url);
    if (isDatabaseConnected()) {
        response.data.metas = await getRatingsfromDB(response.data.metas, providers);
        return response.data;
    } else {
        response.data.metas = await Promise.all(response.data.metas.map(async (meta: any) => {
            return scrapeRatings(meta.id, meta.type, providers);
        }));
        return response.data;
    }
}

export async function trendingCatalog(type: string, extra: any, providers: string[]): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/top/catalog/${type}/top/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url, providers);
}

export async function featuredCataloge(type: string, extra: any, providers: string[]): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/imdbRating/catalog/${type}/imdbRating/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url, providers);
}

export async function searchCatalog(type: string, extra: any, providers: string[]): Promise<any> {
    const url = `${CINEMETA_BASE_URL}/catalog/${type}/search=${extra.search || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url, providers);
}

export async function bestYearByYearCatalog(type: string, extra: any, providers: string[]): Promise<any> {
    const url = `${CINEMETA_CATALOG_URL}/year/catalog/${type}/year/genre=${extra.genre || ''}&skip=${extra.skip || 0}.json`;
    return fetchCatalog(url, providers);
}

export async function handleCatalogRequest({ id, type, extra, config }: any): Promise<any> {
    let providers = DEFAULT_PROVIDERS;
    if (config && config.providers) {
        providers = config.providers;
    }
    let cacheClient = await getContext().cacheClient;
    const key = id + JSON.stringify(extra);
    try {
        // Check if the response is cached
        const cachedResponse = await cacheClient?.get(key);
        if (cachedResponse) {
            const response = JSON.parse(cachedResponse);
            return response;
        }
        let response = { metas: [] };
        switch (id) {
            case "trending":
                response = await trendingCatalog(type, extra, providers);
                break;
            case "featured":
                response = await featuredCataloge(type, extra, providers);
                break;
            case "search":
                response = await searchCatalog(type, extra, providers);
                break;
            case "best_yoy":
                response = await bestYearByYearCatalog(type, extra, providers);
                break;
            default:
                response = { metas: [] };
        }

        // Cache the response for 6 hours
        cacheClient?.set(key, JSON.stringify(response));
        cacheClient?.expire(key, 21600);
        return response;
    } catch (error) {
        console.error("Error in CatalogHandler:", error);
        return { metas: [] };
    }
}