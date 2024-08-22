import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export async function addRatingToImage(base64String: string, ratingMap: { [key: string]: string }): Promise<string> {
    try {
        const base64Data = base64String.replace(/^data:image\/jpeg;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Validate image using sharp
        const image = await sharp(imageBuffer);
        const { width: imageWidth, height: imageHeight } = await image.metadata();

        if (!imageWidth || !imageHeight) return base64String;

        let ratingSvgs = await generateRatingSVGs(imageWidth, imageHeight, ratingMap);
        const overlayTopPosition = imageHeight - ratingSvgs.height;
    
        if (ratingSvgs.total === 0) return base64String;

        const modifiedImageBuffer = await image
            .composite([{ input: Buffer.from(ratingSvgs.svg), top: overlayTopPosition, left: 0 }])
            .toBuffer();

        return `data:image/jpeg;base64,${modifiedImageBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Error in addRatingToImage:', (error as Error).message);
        return base64String;
    }
}

async function generateRatingSVGs(imageWidth: number, imageHeight: number, ratingMap: { [key: string]: string }) {

    const paddingX = Math.floor(imageWidth / 12);
    const paddingY = Math.floor(imageHeight / 25);
    const itemSize = Math.floor(imageWidth / 8);

    let xOffset = paddingX
    let yOffset = paddingY;
    let ratingSvgs = ``;
    let total = 0;

    for (const [key, value] of Object.entries(ratingMap)) {
        const svgFilePath = getSVGFilePath(key, value);
        if (svgFilePath) {
            const svgBuffer = fs.readFileSync(svgFilePath);
            const svgBase64 = svgBuffer.toString('base64');
            const svgImage = `data:image/svg+xml;base64,${svgBase64}`;

            ratingSvgs += `
                <g transform="translate(${xOffset}, ${yOffset})">
                    <image width="${itemSize}" height="${itemSize}" xlink:href="${svgImage}" />
                    <text x="${itemSize + 10}" y="${itemSize - 10}" font-family="Arial" font-weight="600" font-size="28" fill="white" text-anchor="start" dominant-baseline="start">${value}</text>
                </g>`;

            xOffset += itemSize + 30 + paddingX;
            if (xOffset + itemSize > imageWidth) {
                xOffset = paddingX;
                yOffset += itemSize + paddingY;
            }
            total += 1;
        } else {
            console.error(`No SVG found for key: ${key}`);
            continue;
        }
    }

    const svgHeight = Math.ceil(total / 3) * (paddingY + itemSize) + paddingY;

    return {
        svg: `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}" version="1.1">
            <!-- Semi-transparent background -->
            <rect x="0" y="0" width="${imageWidth}" height="${imageHeight}" fill="rgba(0, 0, 0, 0.75)" />
                ${ratingSvgs}
         </svg>
        `,
        height: svgHeight,
        total,
    };
}

function getSVGFilePath(key: string, value: string) {
    if (key === 'metacritic') return path.join(__dirname, '../assets', 'metacritic.svg');
    if (key === 'imdb') return path.join(__dirname, '../assets', 'imdb.svg');
    if (key === 'common_sense_media') return path.join(__dirname, '../assets', 'common_sense_media.svg');
    if (key === 'times_of_india') return path.join(__dirname, '../assets', 'toi.svg');
    if (key === 'rotten_tomatoes') return value > '60'
        ? path.join(__dirname, '../assets', 'rt_fresh.svg')
        : path.join(__dirname, '../assets', 'rt_rotten.svg');
    return null;
}
