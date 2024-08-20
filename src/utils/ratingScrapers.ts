import { MetaDetail } from 'stremio-addon-sdk';
import { getCacheClient } from '../cache';
import { fetchBingRatings, fetchGoogleRatings, fetchYahooRatings, getMetadata } from './api';
import { RedisClientType } from 'redis';
import { addRatingToImage } from './image';
import axios from 'axios';

export async function getRatingsFromGoogle(query: string, imdbId: string, cacheClient: RedisClientType | null): Promise<Record<string, string>> {
    try {
        const ratings = await fetchGoogleRatings(query); // Replace with your logic to fetch ratings from Google

        if (!cacheClient.isOpen) {
            await cacheClient.connect();
        }
        // Cache the ratings if available
        for (const [key, value] of Object.entries(ratings)) {
            const cacheKey = `${imdbId}:${key}`;
            await cacheClient?.set(cacheKey, value);
            await cacheClient?.expire(cacheKey, 86400); // Cache for 1 day
        }

        return ratings;
    } catch (error) {
        console.error(`Error fetching Google ratings: ${(error as Error).message}`);
        throw error;
    }
}

export async function getRatingsFromBing(query: string, imdbId: string, cacheClient: RedisClientType | null): Promise<Record<string, string>> {
    try {
        const ratings = await fetchBingRatings(query); // Replace with your logic to fetch ratings from Bing

        if (!cacheClient.isOpen) {
            await cacheClient.connect();
        }
        // Cache the ratings if available
        for (const [key, value] of Object.entries(ratings)) {
            const cacheKey = `${imdbId}:${key}`;
            await cacheClient?.set(cacheKey, value);
            await cacheClient?.expire(cacheKey, 86400); // Cache for 1 day
        }

        return ratings;
    } catch (error) {
        console.error(`Error fetching Bing ratings: ${(error as Error).message}`);
        throw error;
    }
}

export async function getRatingsFromYahoo(query: string, imdbId: string, cacheClient: RedisClientType | null): Promise<Record<string, string>> {
    try {
        const ratings = await fetchYahooRatings(query); // Replace with your logic to fetch ratings from Yahoo

        if (!cacheClient.isOpen) {
            await cacheClient.connect();
        }
        // Cache the ratings if available
        for (const [key, value] of Object.entries(ratings)) {
            const cacheKey = `${imdbId}:${key}`;
            await cacheClient?.set(cacheKey, value);
            await cacheClient?.expire(cacheKey, 86400); // Cache for 1 day
        }

        return ratings;
    } catch (error) {
        console.error(`Error fetching Yahoo ratings: ${(error as Error).message}`);
        throw error;
    }
}

export async function scrapeRatings(imdbId: string, type: string): Promise<MetaDetail> {
    const cacheClient = await getCacheClient();
    const metadata = await getMetadata(imdbId, type);
    let ratingMap: Record<string, string> = {};
    try {
        const query = `${metadata.name} - ${type}`;

        // Check if ratings are already cached
        ratingMap = await getRatingsFromCache(imdbId, cacheClient);
        if (Object.keys(ratingMap).length == 0) {
            console.log('Ratings not found in cache, fetching from sources...');
            const ratingPromises = [
                getRatingsFromGoogle(query, imdbId, cacheClient).then(ratings => ({ ...ratings })),
                getRatingsFromBing(query, imdbId, cacheClient).then(ratings => ({ ...ratings })),
                getRatingsFromYahoo(query, imdbId, cacheClient).then(ratings => ({ ...ratings })),
            ];
            const firstSuccess = await Promise.any(ratingPromises);
            ratingMap = firstSuccess;
        }
        // Define an array of promises for rating sources

        console.log('Ratings:', ratingMap);

        // Update description with ratings
        metadata.description = metadata.description || '';
        for (const [key, value] of Object.entries(ratingMap)) {
            metadata.description += `(${key.replace('_', ' ')}: ${value}) `;
        }

        // Modify the poster if available
        if (metadata.poster && Object.keys(ratingMap).length > 0) {
            const response = await axios.get(metadata.poster, { responseType: 'arraybuffer' });
            const posterBase64 = Buffer.from(response.data).toString('base64');
            const modifiedPoster = await addRatingToImage(posterBase64, ratingMap);
            metadata.poster = modifiedPoster;
        }

        return metadata;

    } catch (error) {
        console.error(`Error fetching ratings: ${(error as Error).message}`);
        return metadata;
    }
}

async function getRatingsFromCache(imdbId: string, cacheClient: RedisClientType | null): Promise<Record<string, string>> {
    const ratingMap: Record<string, string> = {};
    const ratingKeys = ['imdb', 'metacritic', 'rotten_tomatoes'];

    if (cacheClient) {
        for (const key of ratingKeys) {
            const cacheKey = `${imdbId}:${key}`;
            const rating = await cacheClient.get(cacheKey);
            if (rating) {
                ratingMap[key] = rating;
            }
        }
    }

    return ratingMap;
}
