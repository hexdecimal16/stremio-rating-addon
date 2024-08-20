import axios from "axios";
import { MetaDetail } from "stremio-addon-sdk";
import { CINEMETA_BASE_URL } from '../constants/urls';
import { fetchNetwork } from "../network";
import * as cheerio from 'cheerio';

export async function getMetadata(imdb: string, type: string): Promise<MetaDetail> {
    try {
        const url = `${CINEMETA_BASE_URL}/meta/${type}/${imdb}.json`;
        const response = await axios.get(url)
        return response.data.meta;
    } catch (error) {
        console.error(`Error fetching metadata: ${(error as Error).message}`);
        return {} as MetaDetail;
    }
}

export async function fetchGoogleRatings(query: string) {
    const response = await fetchNetwork(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(response);
    const ratingMap: { [key: string]: string } = {};

    $('div.Ap5OSd').first().text().split('\n').forEach(text => {
        const [score, source] = text.split('·').map(s => s.trim());
        if (score && source) ratingMap[formatSourceKey(source)] = formatScore(score);
    });

    return ratingMap;
}

export async function fetchBingRatings(query: string) {
    const response = await fetchNetwork(`https://www.bing.com/search?q=${query}`);
    const $ = cheerio.load(response);
    const ratingMap: { [key: string]: string } = {};

    $('div.l_ecrd_ratings_txt').each((_, element) => {
        const source = $(element).find('div.l_ecrd_txt_qfttl').text().trim();
        const score = $(element).find('div.l_ecrd_ratings_prim').text().trim();
        ratingMap[formatSourceKey(source)] = formatScore(score);
    });

    return ratingMap;
}

export async function fetchYahooRatings(query: string) {
    const response = await fetchNetwork(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`);
    const $ = cheerio.load(response);
    const ratingMap: { [key: string]: string } = {};

    const ratingText = $('span.rottenTomatoes');
    if (ratingText.length > 0) {
        const score = formatScore(ratingText.text());
        ratingMap['rotten_tomatoes'] = score;
    }

    return ratingMap;
}


export function formatSourceKey(source: string): string {
    return source
        .toLowerCase()          // Convert to lowercase
        .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric characters with underscores
        .replace(/_+/g, '_')    // Replace multiple underscores with a single one
        .replace(/^_+|_+$/g, '');  // Trim underscores from the start and end
}

export function formatScore(score: string): string {
    score = score.split('/')[0]; // Remove the denominator
    score = score.split(' ')[0]; // Remove the denominator
    score = score.split('%')[0]; // Remove the percentage sign
    score = score.replace(/[^0-9.]/g, ''); // Remove non-numeric characters
    return score;
}