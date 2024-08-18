const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const { MovieDb } = require('moviedb-promise');
const path = require('path');

const moviedb = new MovieDb('YOUR_TMDB_API_KEY', 'https://api.tmdb.org/3/');

// Define your manifest
const manifest = {
    "id": "org.stremio.ratings",
    "version": "1.0.0",
    "name": "Ratings from Multiple Sources",
    "description": "Adds ratings from IMDb, Rotten Tomatoes, Metacritic, Crunchyroll, Filmaffinity, Gadgets 360, and others to description and poster in Stremio.",
    "resources": [
        "catalog",
        "meta"
    ],
    "types": ["movie", "series"],
    "idPrefixes": ["tt"],
    catalogs: [
        {
            id: 'trending',
            name: 'Trending',
            type: 'movie',
            extra: []
        },
        {
            id: 'trending',
            name: 'Trending',
            type: 'series',
            extra: [{ name: 'search' }]
        },
        {
            id: 'discover',
            name: 'Discover',
            type: 'movie',
            extra: [
                {
                    name: 'genre', isRequired: false, options: [
                        "popularity.asc",
                        "popularity.desc",
                        "release_date.asc",
                        "release_date.desc",
                        "revenue.asc",
                        "revenue.desc",
                        "primary_release_date.asc",
                        "primary_release_date.desc",
                        "original_title.asc",
                        "original_title.desc",
                        "vote_average.asc",
                        "vote_average.desc",
                        "vote_count.asc",
                        "vote_count.desc"
                    ]
                }
            ]
        },
        {
            id: 'discover',
            name: 'Discover',
            type: 'series',
            extra: [
                {
                    name: 'genre', isRequired: false, options: [
                        "popularity.asc",
                        "popularity.desc",
                        "release_date.asc",
                        "release_date.desc",
                        "revenue.asc",
                        "revenue.desc",
                        "primary_release_date.asc",
                        "primary_release_date.desc",
                        "original_title.asc",
                        "original_title.desc",
                        "vote_average.asc",
                        "vote_average.desc",
                        "vote_count.asc",
                        "vote_count.desc"
                    ]
                }
            ]
        },
        {
            id: 'search',
            name: 'Search',
            type: 'movie',
            extra: [{ name: 'search', isRequired: true }]
        },
        {
            id: 'search',
            name: 'Search',
            type: 'series',
            extra: [{ name: 'search', isRequired: true }]
        }
    ]
};

// Create a new addon builder
const builder = new addonBuilder(manifest);

async function addRatingToImage(base64String, ratingMap) {
    try {
        // Remove base64 metadata and convert to buffer
        const base64Data = base64String.replace(/^data:image\/jpeg;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Validate image format
        await sharp(imageBuffer).metadata();

        const image = sharp(imageBuffer);
        const { width: imageWidth, height: imageHeight } = await image.metadata();

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
            let svgFilePath;
            if (key === 'metacritic') {
                svgFilePath = path.join(__dirname, 'assets', 'metacritic.svg');
            } else if (key === 'imdb') {
                svgFilePath = path.join(__dirname, 'assets', 'imdb.svg');
            } else if (key === 'rotten_tomatoes') {
                svgFilePath = value > 60
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
        console.error('Error in addRatingToImage:', error.message);
        // Return the original image if an error occurs
        return base64String;
    }
}

async function getMetadata(imdb, type) {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdb}.json`;
        const response = await axios.get(url);
        return response.data.meta;
    } catch (error) {
        console.error(`Error fetching metadata: ${error.message}`);
        return { title: 'N/A' };
    }
}

// Scrape ratings and get posters
async function scrapeRatings(imdbId, type) {
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
        const ratingMap = {};

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
            } else {
                return;
            }
            description += ` (${rating[1].trim()}: ${score})`;
            ratingText += `${rating[1].trim()}: ${score} `;
            ratingMap[source] = score;
        });

        const posterUrl = metadata.poster;
        const posterResponse = await axios.get(posterUrl, { responseType: 'arraybuffer' });
        const posterBase64 = `data:image/jpeg;base64,${Buffer.from(posterResponse.data).toString('base64')}`;
        const posterWithRating = await addRatingToImage(posterBase64, ratingMap);

        metadata.poster = posterWithRating;
        metadata.description = description;

        return metadata;
    } catch (error) {
        console.error(`Error fetching ratings: ${error.message}`);
        return { title: 'N/A' };
    }
}

// Define the meta handler for the addon
builder.defineMetaHandler(async (args) => {
    console.log('Received meta request:', args);
    const imdbId = args.id;
    const type = args.type;
    const metadata = await scrapeRatings(imdbId, type);
    console.log('Meta:', metadata);
    return { meta: metadata };
});

async function trendingCatalog(type) {
    const trendingRequest = {
        media_type: type == 'movie' ? 'movie' : 'tv',
        time_window: 'week'
    };

    // Fetch trending data
    const response = await moviedb.trending(trendingRequest);

    // Collect all the promises for fetching external IDs
    const idPromises = response.results.map(async (curr) => {
        if (trendingRequest.media_type === 'movie') {
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            return movieExternalResult.imdb_id;
        } else {
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            return tvExternalResult.imdb_id;
        }
    });

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id != '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return Promise.resolve({ metas });
}

async function discoverCatalog(type, extra) {

    page = 0
    if (extra.skip) {
        // if each page has 20 items, we can skip 20 items per page
        page = Math.floor(extra.skip / 20);
    }
    let idPromises = [];
    if (type == 'movie') {
        const currentDate = new Date();
        const discoverRequest = {
            sort_by: extra.genre || 'popularity.desc',
            with_runtime: {
                gte: 30
            },
            release_date: {
                lte: currentDate.getFullYear() + '-' + (currentDate.getMonth() + 1) + '-' + currentDate.getDate()
            },
            page: page + 1
        };

        console.log(discoverRequest);

        const response = await moviedb.discoverMovie(discoverRequest);

        idPromises = response.results.map(async (curr) => {
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            return movieExternalResult.imdb_id;
        });

    } else {
        const discoverRequest = {
            sort_by: extra.genre || 'popularity.desc',
            page: page + 1
        };

        const response = await moviedb.discoverTv(discoverRequest);
        console.log(response);

        idPromises = response.results.map(async (curr) => {
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            return tvExternalResult.imdb_id;
        });
    }

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id != '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return Promise.resolve({ metas });
}

async function searchCatalog(type, extra) { 
    console.log('Search:', extra.search);
    query = extra.search;

    let idPromises = [];
    if (type == 'movie') {
        const response = await moviedb.searchMovie({ query: query });
        console.log(response);

        idPromises = response.results.map(async (curr) => {
            const movieExternalResult = await moviedb.movieExternalIds({ id: curr.id });
            return movieExternalResult.imdb_id;
        });

    } else {
        const response = await moviedb.searchTv({ query: query });
        console.log(response);

        idPromises = response.results.map(async (curr) => {
            const tvExternalResult = await moviedb.tvExternalIds({ id: curr.id });
            return tvExternalResult.imdb_id;
        });
    }

    // Resolve all the promises concurrently
    const ids = (await Promise.all(idPromises)).filter(id => id != '');
    // Collect all the promises for scraping ratings
    const metaPromises = ids.map(id => scrapeRatings(id, type));

    // Resolve all the promises concurrently
    const metas = await Promise.all(metaPromises);

    return Promise.resolve({ metas });
}

// Define the catalog handler for the addon
builder.defineCatalogHandler(async (args) => {
    console.log('Received catalog request:', args);
    const type = args.type;
    const catalogId = args.id;

    if (catalogId === 'trending') {
        return trendingCatalog(type);
    } else if (catalogId === 'discover') {
        return discoverCatalog(type, args.extra);
    } else if (catalogId === 'search') {
        return searchCatalog(type, args.extra);
    }
})

// Start the addon server
serveHTTP(builder.getInterface(), { port: 10000 });

console.log('Addon running on http://localhost:10000');