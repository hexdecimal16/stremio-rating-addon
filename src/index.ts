import { addonBuilder, serveHTTP, Args, MetaDetail } from 'stremio-addon-sdk';
import * as fs from 'fs';
import axios from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import { MovieDb, DiscoverTvRequest, DiscoverMovieRequest, TvResult, MovieResult, TrendingRequest, PersonResult } from 'moviedb-promise';
import * as path from 'path';


// Load environment variables from .env file
dotenv.config();

// Get TMDB API key from environment variable
const tmdbApiKey = process.env.TMDB_API_KEY;

if (!tmdbApiKey) {
    throw new Error('TMDB_API_KEY is not defined in the environment variables');
}

const moviedb = new MovieDb(tmdbApiKey, 'https://api.tmdb.org/3/');


// Load the addon manifest
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf-8'));

// Create a new addon builder
const builder = new addonBuilder(manifest);

async function addRatingToImage(base64String: string, ratingMap: { [key: string]: string }): Promise<string> {
    try {
        // Remove base64 metadata and convert to buffer
        const base64Data = base64String.replace(/^data:image\/jpeg;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Validate image using sharp
        await sharp(imageBuffer).metadata()
        

        const image = sharp(imageBuffer);
        const { width: imageWidth, height: imageHeight } = await image.metadata();

        // Ensure image dimensions are found
        if (!imageWidth || !imageHeight) {
            console.error('Image dimensions not found');
            return base64String;
        }

        // Define SVG dimensions and padding
        const svgWidth = imageWidth;  // Set SVG width to the image width
        const padding = 20;
        const itemWidth = 100; // Width for each rating item
        const itemHeight = 50; // Height for each rating item

        // Add rating publisher source image and score
        let xOffset = padding; // Initial x offset for the first item
        let yOffset = padding; // y offset for the row

        let ratingSvgs = '';
        let totalRatings = 0;
        for (const [key, value] of Object.entries(ratingMap)) {
            let svgFilePath: string | undefined;
            if (key === 'metacritic') {
                svgFilePath = path.join(__dirname, 'assets', 'metacritic.svg');
            } else if (key === 'imdb') {
                svgFilePath = path.join(__dirname, 'assets', 'imdb.svg');
            } else if (key === 'rotten_tomatoes') {
                svgFilePath = value > '60'
                    ? path.join(__dirname, 'assets', 'rt_fresh.svg')
                    : path.join(__dirname, 'assets', 'rt_rotten.svg');
            }

            if (svgFilePath) {
                const svgBuffer = fs.readFileSync(svgFilePath);
                const svgBase64 = svgBuffer.toString('base64');
                const svgImage = `data:image/svg+xml;base64,${svgBase64}`;

                ratingSvgs += `<image x="${xOffset}" y="${yOffset}" width="${itemHeight}" height="${itemHeight}" xlink:href="${svgImage}" />`;
                ratingSvgs += `<text x="${xOffset + itemHeight + 10}" y="${yOffset + itemHeight / 2}" font-size="20" fill="white" text-anchor="start" alignment-baseline="middle">${value}</text>`;

                // Update xOffset for the next item
                xOffset += itemWidth;

                // If xOffset exceeds SVG width, move to the next row
                if (xOffset + itemWidth > svgWidth) {
                    xOffset = padding;
                    yOffset += itemHeight + padding;
                }

                // Update total ratings
                totalRatings++;
            }
        }

        // Calculate SVG height based on the number of rows
        const svgHeight = (yOffset + itemHeight + padding) * Math.ceil(totalRatings / 3) + padding;

        // Adjust yOffset to place the overlay at the bottom of the image
        const overlayTopPosition = imageHeight - svgHeight;

        let svgText = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" version="1.1">
            <!-- Semi-transparent background -->
            <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="rgba(0, 0, 0, 0.5)" />
        `;

        // Add rating items to the SVG
        svgText += ratingSvgs;

        svgText += '</svg>';

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

async function getMetadata(imdb: string, type: string): Promise<MetaDetail> {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdb}.json`;
        const response = await axios.get(url);
        return response.data.meta;
    } catch (error) {
        console.error(`Error fetching metadata: ${(error as Error).message}`);
        return {} as MetaDetail;
    }
}

// Scrape ratings and get posters
async function scrapeRatings(imdbId: string, type: string): Promise<MetaDetail> {
    try {
        const metadata = await getMetadata(imdbId, type);
        const cleanTitle = metadata.name;
        let description = metadata.description || '';

        if (!cleanTitle) {
            console.error('Title not found');
            return metadata;
        }

        const url = `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)} - ${type}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        let ratingsDiv = $('div.Ap5OSd').first();
        let ratingText = '';
        const ratingMap: { [key: string]: string } = {};

        if (!ratingsDiv) {
            console.error('Ratings div not found');
            return metadata;
        }
        let ratingsText = ratingsDiv.text();
        let ratings = ratingsText.split('\n').map(r => r.split('�')).filter(r => r.length > 1);
        ratings.forEach(rating => {
            let source = rating[1].trim().replace(" ", "_").toLowerCase();
            let score = rating[0].trim();
            if (score.includes('/')) {
                score = score.split('/')[0];
            } else if (score.includes('%')) {
                score = score.split('%')[0];
            }
            ratingMap[source] = score;
        });
        // Add descriptions to metadata
        const scrapeTitle = $('h2.LL6Nsc').first();
        if (scrapeTitle && scrapeTitle.text()) {
            description += `\nRating Source: ${scrapeTitle.text()}`;
        }

        if (metadata.poster) {
            const modifiedPoster = await addRatingToImage(metadata.poster, ratingMap);
            metadata.poster = modifiedPoster;
        }

        metadata.description = description;
        return metadata;

    } catch (error) {
        console.error(`Error fetching ratings: ${(error as Error).message}`);
        return {} as MetaDetail;
    }
}

// Define the "meta" resource
builder.defineMetaHandler(async (args: { id: string, type: string }) => {
    const { id, type } = args;
    let metadata: MetaDetail = {} as MetaDetail;
    if (id.startsWith('tt')) {
        const imdbId = id.split(':')[0];
        metadata = await scrapeRatings(imdbId, type);
    }

    return { meta: metadata };
});



// Fetch trending catalog
async function trendingCatalog(type: string): Promise<any> {
    const trendingRequest: TrendingRequest = {
        media_type: type === 'movie' ? 'movie' : 'tv',
        time_window: 'week'
    };

    // Fetch trending data
    const response = await moviedb.trending(trendingRequest);
    if (response.results == undefined) {
        return { metas: [] };
    }

    // Collect all the promises for fetching external IDs
    const idPromises = response.results.map(async (curr: MovieResult | TvResult | PersonResult) => {
        if (curr.id == undefined) {
            return '';
        }
        if (trendingRequest.media_type === 'movie') {
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            if (movieExternalResult.imdb_id == undefined) {
                return '';
            }
            return movieExternalResult.imdb_id;
        } else {
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            if (tvExternalResult.imdb_id == undefined) {
                return '';
            }
            return tvExternalResult.imdb_id;
        }
    });

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id !== '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return { metas };
}

// Fetch discover catalog
async function discoverCatalog(type: string, extra: any): Promise<any> {
    let page = 0;
    if (extra?.skip) {
        page = Math.floor(extra.skip / 20);
    }
    let idPromises: Promise<string>[] = [];
    if (type === 'movie') {
        const currentDate = new Date();
        const discoverRequest: DiscoverMovieRequest = {
            sort_by: extra?.genre || 'popularity.desc',
            "with_runtime.gte": 30,
            "release_date.lte": `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`,
            page: page + 1
        };

        const response = await moviedb.discoverMovie(discoverRequest);
        if (response.results == undefined) {
            return { metas: [] };
        }

        idPromises = response.results.map(async (curr: MovieResult) => {
            if (curr.id == undefined) {
                return '';
            }
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            if (movieExternalResult.imdb_id == undefined) {
                return '';
            }
            return movieExternalResult.imdb_id;
        });

    } else {
        const discoverRequest: DiscoverTvRequest = {
            sort_by: extra?.genre || 'popularity.desc',
            page: page + 1
        };

        const response = await moviedb.discoverTv(discoverRequest);
        if (response.results == undefined) {
            return { metas: [] };
        }

        idPromises = response.results.map(async (curr: TvResult) => {
            if (curr.id == undefined) {
                return '';
            }
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            if (tvExternalResult.imdb_id == undefined) {
                return '';
            }
            return tvExternalResult.imdb_id;
        });
    }

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id !== '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return { metas };
}

// Fetch search catalog
async function searchCatalog(type: string, extra: any): Promise<any> {
    console.log('Search:', extra?.search);
    const query = extra?.search || '';

    let idPromises: Promise<string>[] = [];
    if (type === 'movie') {
        const response = await moviedb.searchMovie({ query });
        if (response.results == undefined) {
            return { metas: [] };
        }
        idPromises = response.results?.map(async (curr: MovieResult) => {
            if (curr.id == undefined) {
                return '';
            }
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            if (movieExternalResult.imdb_id == undefined) {
                return '';
            }
            return movieExternalResult.imdb_id;
        });

    } else {
        const response = await moviedb.searchTv({ query });
        if (response.results == undefined) {
            return { metas: [] };
        }
        idPromises = response.results.map(async (curr: TvResult) => {
            if (curr.id == undefined) {
                return '';
            }
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            if (tvExternalResult.imdb_id == undefined) {
                return '';
            }
            return tvExternalResult.imdb_id;
        });
    }

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id !== '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return { metas };
}

// Define the catalog handler for the addon
builder.defineCatalogHandler(async (args: Args) => {
    console.log('Received catalog request:', args);
    const { type, id: catalogId, extra } = args;

    if (catalogId === 'trending') {
        return trendingCatalog(type);
    } else if (catalogId === 'discover') {
        return discoverCatalog(type, extra);
    } else if (catalogId === 'search') {
        return searchCatalog(type, extra);
    }
});

// Start the HTTP server
serveHTTP(builder.getInterface(), { port: 7000 });

