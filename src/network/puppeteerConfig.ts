import puppeteer, { BrowserLaunchArgumentOptions, LaunchOptions } from 'puppeteer';
import fakeUa from 'fake-useragent';
import { getCurrentProxy } from './proxy';
import { MAX_PUPPETEER_REQUESTS } from '../constants/costants';



let puppeteerQueue: Array<() => Promise<void>> = [];
let activePuppeteerRequests = 0;

async function queuePuppeteerRequest(url: string, useProxy: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
        puppeteerQueue.push(async () => {
            try {
                const content = await fetchWithPuppeteer(url, useProxy);
                resolve(content);
            } catch (error) {
                reject(error);
            }
        });
        processPuppeteerQueue();
    });
}

async function processPuppeteerQueue() {
    if (activePuppeteerRequests >= MAX_PUPPETEER_REQUESTS || puppeteerQueue.length === 0) {
        return;
    }

    const puppeteerRequest = puppeteerQueue.shift();
    if (puppeteerRequest) {
        activePuppeteerRequests++;
        await puppeteerRequest();
        activePuppeteerRequests--;
        processPuppeteerQueue();
    }
}

async function fetchWithPuppeteer(url: string, useProxy: boolean): Promise<string> {
    const launchOptions: LaunchOptions & BrowserLaunchArgumentOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };

    if (useProxy) {
        const proxy = getCurrentProxy();
        if (proxy) {
            launchOptions.args.push(`--proxy-server=${proxy}`);
        }
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent(fakeUa());
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.resourceType() === 'image') request.abort();
        else request.continue();
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return await page.content();
    } catch (error) {
        console.error('Puppeteer error:', (error as Error).message);
        throw error;
    } finally {
        await browser.close();
    }
}

export { queuePuppeteerRequest };
