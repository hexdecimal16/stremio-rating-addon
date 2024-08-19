import { addonBuilder, serveHTTP, Args, MetaDetail } from 'stremio-addon-sdk';
import * as fs from 'fs';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as path from 'path';
import manifest from './manifest';
import fakeUa from 'fake-useragent'


// TODO: set proxy in future
async function setProxy(): Promise<AxiosInstance> {
    return axios.create({});
}

// Load environment variables from .env file
dotenv.config();

// Create a new addon builder
const builder = new addonBuilder(manifest);

async function addRatingToImage(base64String: string, ratingMap: { [key: string]: string }): Promise<string> {
    try {
        // Remove base64 metadata and convert to buffer
        const base64Data = base64String.replace(/^data:image\/jpeg;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Validate image using sharp
        await sharp(imageBuffer).metadata();

        const image = sharp(imageBuffer);
        const { width: imageWidth, height: imageHeight } = await image.metadata();

        // Ensure image dimensions are found
        if (!imageWidth || !imageHeight) {
            console.error('Image dimensions not found');
            return base64String;
        }

        // Define SVG dimensions and padding
        const svgWidth = imageWidth;  // Set SVG width to the image width
        const paddingX = Math.floor(imageWidth / 15); // Padding between rating items
        const paddingY = Math.floor(imageHeight / 25); // Padding between rating items
        const itemWidth = Math.floor(imageWidth / 4); // Width for each rating item
        const itemHeight = Math.floor(itemWidth / 3); // Height for each rating item

        // Add rating publisher source image and score
        let xOffset = paddingX; // Initial x offset for the first item
        let yOffset = paddingY; // y offset for the row

        let ratingSvgs = '';
        let totalRatings = 0;
        for (const [key, value] of Object.entries(ratingMap)) {
            let svgFilePath: string | undefined;
            if (key === 'metacritic') {
                svgFilePath = path.join(__dirname, '../assets', 'metacritic.svg');
            } else if (key === 'imdb') {
                svgFilePath = path.join(__dirname, '../assets', 'imdb.svg');
            } else if (key === 'rotten_tomatoes') {
                svgFilePath = value > '60'
                    ? path.join(__dirname, '../assets', 'rt_fresh.svg')
                    : path.join(__dirname, '../assets', 'rt_rotten.svg');
            }

            if (svgFilePath) {
                const svgBuffer = fs.readFileSync(svgFilePath);
                const svgBase64 = svgBuffer.toString('base64');
                const svgImage = `data:image/svg+xml;base64,${svgBase64}`;

                // Add SVG image and text to the overlay
                ratingSvgs += `
                    <g transform="translate(${xOffset}, ${yOffset})">
                        <image width="${itemHeight}" height="${itemHeight}" xlink:href="${svgImage}" />
                        <text x="${itemHeight + 10}" y="${itemHeight}" font-size="28" font-weight="600" fill="white" text-anchor="start" dominant-baseline="end">${value}</text>
                    </g>`;

                // Update xOffset for the next item
                xOffset += itemWidth + paddingX;

                // If xOffset exceeds SVG width, move to the next row
                if (xOffset + itemWidth > svgWidth) {
                    xOffset = paddingX;
                    yOffset += itemHeight + paddingY;
                }

                // Update total ratings
                totalRatings++;
            }
        }

        // Calculate SVG height based on the number of rows
        const svgHeight = yOffset + itemHeight + paddingY;

        // Adjust yOffset to place the overlay at the bottom of the image
        const overlayTopPosition = imageHeight - svgHeight;

        let svgText = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" version="1.1">
            <!-- Semi-transparent background -->
            <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="rgba(0, 0, 0, 0.75)" />
            ${ratingSvgs}
        </svg>`;

        // Ensure SVG overlay is not empty
        if (svgText === `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" version="1.1"></svg>`) {
            throw new Error('SVG overlay is empty');
        }

        // Add the SVG overlay to the bottom of the image
        const modifiedImageBuffer = await image
            .composite([{ input: Buffer.from(svgText), top: overlayTopPosition, left: 0 }])
            .toBuffer();

        const modifiedBase64 = modifiedImageBuffer.toString('base64');
        return `data:image/jpeg;base64,${modifiedBase64}`;
    } catch (error) {
        console.error('Error in addRatingToImage:', (error as Error).message);
        // Return the original image if an error occurs
        return base64String;
    }
}

async function getMetadata(axiosInstance: AxiosInstance, imdb: string, type: string): Promise<MetaDetail> {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdb}.json`;
        const response = await axiosInstance.get(url)
        return response.data.meta;
    } catch (error) {
        console.error(`Error fetching metadata: ${(error as Error).message}`);
        return {} as MetaDetail;
    }
}

async function getRatingsFromGoogle(axiosInstance: AxiosInstance, query: string): Promise<{ [key: string]: string }> {
    const headers = {
        'User-Agent': fakeUa()
    };

    let response: AxiosResponse;
    try {
        response = await axiosInstance.get(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { headers });
    } catch (error: any) {
        const axiosError = error as AxiosError;
        if (axiosError.response == undefined ||
            axiosError.request == undefined ||
            axiosError.response.status != 429
        ) {
            throw error;
        }
        throw new Error('Google blocked');
    } finally {
        console.log('Google request completed');
    }
    const html = response.data;
    const $ = cheerio.load(html);

    let ratingsDiv = $('div.Ap5OSd').first();
    const ratingMap: { [key: string]: string } = {};

    console.log(`Google Ratings div for ${query}:`, ratingsDiv.length);
    const ratingsText = ratingsDiv.text();
    console.log('Google Ratings text:', ratingsText);
    let ratings = ratingsText.split('\n').map(r => r.split('�')).filter(r => r.length > 1);
    if (ratings.length === 0) {
        ratings = ratingsText.split('\n').map(r => r.split('·')).filter(r => r.length > 1);
    }
    if (ratings.length === 0) {
        throw new Error('Ratings not found');
    }
    ratings.forEach(rating => {
        let source = rating[1].trim()
        let score = rating[0].trim();

        if (score.includes('/')) {
            score = score.split('/')[0];
        } else if (rating.includes('%')) {
            score = score.split('%')[0];
        }
        const sourceKey = source.trim().replace(" ", "_").toLowerCase();
        ratingMap[sourceKey] = score;
    });

    console.log('Rating map:', ratingMap);
    return ratingMap;
}

async function getRatingsFromBing(axiosInstance: AxiosInstance, query: string): Promise<{ [key: string]: string }> {
    const headers = {
        'User-Agent': fakeUa()
    };

    query = query.replace(/ /g, '+');
    const url = `https://www.bing.com/search?q=${query}`;
    console.log('Bing URL:', url);
    const response = await axiosInstance.get(url, { headers });
    const html = response.data;
    const $ = cheerio.load(html);


    // get divs with tag l_ecrd_ratings_txt
    const ratingsDiv = $('div.l_ecrd_ratings_txt');
    const ratingMap: { [key: string]: string } = {};

    // console.log(`Bing Ratings div for ${query}:`, ratingsDiv.length);
    if (ratingsDiv.length === 0) {
        throw new Error('Ratings not found');
    }
    ratingsDiv.each((index, element) => {
        let rating = $(element).find('div.l_ecrd_ratings_prim').text();
        let source = $(element).find('div.l_ecrd_txt_qfttl').text().trim();
        if (rating.includes('/')) {
            rating = rating.split('/')[0];
        } else if (rating.includes('%')) {
            rating = rating.split('%')[0];
        }
        const sourceKey = source.trim().replace(" ", "_").toLowerCase();
        ratingMap[sourceKey] = rating;
    });

    console.log('Rating map:', ratingMap);
    return ratingMap;
}

function firstResolved<T>(promises: Promise<T>[]): Promise<T> {
    return new Promise((resolve, reject) => {
        let errors: any[] = [];
        const total = promises.length;

        promises.forEach(promise => {
            promise
                .then(resolve)
                .catch((error) => {
                    errors.push(error);
                    console.error("Promise rejected with error:", error);

                    // If all promises have been rejected, reject the main promise
                    if (errors.length === total) {
                        reject(errors);
                    }
                });
        });
    });
}


// Scrape ratings and get posters
// async function scrapeRatings(imdbId: string, type: string, browser?: Browser, axiosInstance?: AxiosInstance): Promise<MetaDetail> {
async function scrapeRatings(imdbId: string, type: string, axiosInstance?: AxiosInstance): Promise<MetaDetail> {
    if (!axiosInstance) {
        axiosInstance = await setProxy();
    }
    const metadata = await getMetadata(axiosInstance, imdbId, type);
    try {
        const cleanTitle = metadata.name;
        let description = metadata.description || '';

        if (!cleanTitle) {
            console.error('Title not found');
            return metadata;
        }

        const query = `${cleanTitle} - ${type}`;
        let ratingMap = await firstResolved([
            getRatingsFromBing(axiosInstance, query),
            getRatingsFromGoogle(axiosInstance, query)
        ]);

        for (const [key, value] of Object.entries(ratingMap)) {
            description += `(${key.replace("_", " ")}: ${value}) `;
        }

        if (metadata.poster) {
            const response = await axios.get(metadata.poster, { responseType: 'arraybuffer' });
            const posterBase64 = Buffer.from(response.data).toString('base64');
            metadata.poster = `data:image/jpeg;base64,${posterBase64}`;
            const modifiedPoster = await addRatingToImage(metadata.poster, ratingMap);
            metadata.poster = modifiedPoster;
        }

        metadata.description = description;
        return metadata;

    } catch (error) {
        console.error(`Error fetching ratings: ${(error as Error).message}`);
        return metadata;
    }
}

// Define the "meta" resource
builder.defineMetaHandler(async (args: { id: string, type: string }) => {
    console.log('Received meta request:', args);
    const axios = await setProxy();
    const { id, type } = args;
    let metadata: MetaDetail = {} as MetaDetail;
    if (id.startsWith('tt')) {
        const imdbId = id.split(':')[0];
        metadata = await scrapeRatings(imdbId, type, axios);
    }

    console.log('Finished meta request:', metadata);
    return { meta: metadata };
});


const cinemeta_catalog = 'https://cinemeta-catalogs.strem.io';

// Fetch trending catalog
async function trendingCatalog(type: string, extra: any): Promise<any> {
    const axios = await setProxy();
    const genre = extra?.genre || '';
    const skip = extra?.skip || 0;
    const url = `${cinemeta_catalog}/top/catalog/${type}/top/genre=${genre}&skip=${skip}.json`;
    console.log('Fetching trending catalog:', url);
    const response = await axios.get(url);

    response.data.metas = await Promise.all(response.data.metas.map(async (meta: MetaDetail) => {
        const metadata = await scrapeRatings(meta.id, type, axios);
        return metadata;
    }));
    return response.data;
}

// Fetch discover catalog
async function featuredCataloge(type: string, extra: any): Promise<any> {
    const axios = await setProxy();
    const genre = extra?.genre || '';
    const skip = extra?.skip || 0;
    const url = `${cinemeta_catalog}/imdbRating/catalog/${type}/imdbRating/genre=${genre}&skip=${skip}.json`;
    console.log('Fetching featured catalog:', url);
    const response = await axios.get(url);

    response.data.metas = await Promise.all(response.data.metas.map(async (meta: MetaDetail) => {
        const metadata = await scrapeRatings(meta.id, type, axios);
        return metadata;
    }));
    return response.data;
}

// Fetch search catalog
async function searchCatalog(type: string, extra: any): Promise<any> {
    const axios = await setProxy();
    const query = extra?.search || '';
    const skip = extra?.skip || 0;
    const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${query}&skip=${skip}.json`;
    console.log('Fetching search catalog:', url);
    const response = await axios.get(url);

    response.data.metas = await Promise.all(response.data.metas.map(async (meta: MetaDetail) => {
        const metadata = await scrapeRatings(meta.id, type, axios);
        return metadata;
    }));
    return response.data;
}

// Fetch the best year by year catalog
async function bestYearByYearCatalog(type: string, extra: any): Promise<any> {
    const axios = await setProxy();
    const year = extra?.genre || new Date().getFullYear();
    const skip = extra?.skip || 0;
    const response = await axios.get(`${cinemeta_catalog}/year/catalog/${type}/year/genre=${year}&skip=${skip}.json`);

    response.data.metas = await Promise.all(response.data.metas.map(async (meta: MetaDetail) => {
        const metadata = await scrapeRatings(meta.id, type, axios);
        return metadata;
    }));
    return response.data;
}

// Define the catalog handler for the addon
builder.defineCatalogHandler(async (args: Args) => {
    console.log('Received catalog request:', args);
    const { type, id: catalogId, extra } = args;

    if (catalogId === 'trending') {
        return trendingCatalog(type, extra);
    } else if (catalogId === 'featured') {
        return featuredCataloge(type, extra);
    } else if (catalogId === 'search') {
        return searchCatalog(type, extra);
    } else if (catalogId === 'best_yoy') {
        return bestYearByYearCatalog(type, extra);
    }
});

// Start the HTTP server
const port = Number(process.env.PORT) || 7000;
serveHTTP(builder.getInterface(), { port });

console.log(`🚀 Link for addon http://localhost:${port}`);
console.log(`🚀 Link for manifest http://localhost:${port}/manifest.json`);

