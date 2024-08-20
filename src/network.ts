import axios, { AxiosInstance } from "axios";
import fakeUa from "fake-useragent";
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import puppeteer, { BrowserLaunchArgumentOptions, LaunchOptions } from 'puppeteer';

let proxyList: string[] = [];
let currentProxyIndex = 0;
let lastProxyFetchTime = 0;
const proxyFetchInterval = 60 * 60 * 1000; // 1 hour in milliseconds
let isFetchingProxies = false; // Lock to prevent concurrent fetches
let isRotationPossible = true; // Flag to check if proxy rotation is possible
let puppeteerQueue: Array<() => Promise<void>> = []; // Queue for Puppeteer requests
let activePuppeteerRequests = 0; // Counter for active Puppeteer requests
const MAX_PUPPETEER_REQUESTS = 2; // Maximum number of concurrent Puppeteer requests
const TIMEOUT = 2000; // Timeout for network requests in milliseconds
const PROXY_LIST_LIMIT = 100; // Maximum number of proxies to fetch

let axiosInstance: AxiosInstance = axios.create({ timeout: TIMEOUT });

// Add an interceptor to rotate proxy on timeout or network errors
function setupAxiosInterceptors(axiosInstance: AxiosInstance): AxiosInstance {
    axiosInstance.interceptors.response.use(
        response => response,
        async error => {
            console.error('Axios error:', error.code, error.message);
            if (['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_BAD_REQUEST'].includes(error.code) || error.code == undefined) {
                console.warn('Request failed, rotating proxy...');
                return isRotationPossible ? rotateProxyAndRetry(error) : Promise.reject(error);
            }
            return Promise.reject(error);
        }
    );

    return axiosInstance;
}

// Function to rotate the proxy and retry the failed request
async function rotateProxyAndRetry(error: any): Promise<any> {
    await rotateProxy();
    const config = error.config;
    return axiosInstance(config);
}

// Fetch and cache proxy list
async function fetchProxyList(): Promise<void> {
    if (isFetchingProxies) {
        // If another fetch is in progress, wait for it to finish
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!isFetchingProxies) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    const PROXY_URL = process.env.PROXY_URL || 'https://github.com/zloi-user/hideip.me/raw/main/https.txt'; 

    isFetchingProxies = true;
    try {
        const response = await axios.get(PROXY_URL, { headers: { 'User-Agent': fakeUa(), timeout: TIMEOUT } });
        const proxyData: string[] = response.data.split('\n');
        console.log('Fetched proxy data:', proxyData.length, 'proxies');
        proxyList = proxyData.map(proxy => proxy.trim().split(':').slice(0, 2).join(':')).filter(Boolean);
        if (proxyList.length > PROXY_LIST_LIMIT) {
            proxyList = proxyList.slice(0, PROXY_LIST_LIMIT);
        }
        currentProxyIndex = 0;
        lastProxyFetchTime = Date.now();
    } catch (error) {
        console.error('Failed to fetch proxy list:', error.message);
    } finally {
        isFetchingProxies = false;
    }
}

// Refresh the proxy list if it's outdated
async function refreshProxyListIfNeeded(): Promise<void> {
    if (Date.now() - lastProxyFetchTime > proxyFetchInterval || proxyList.length === 0) {
        await fetchProxyList();
    }
}

// Rotate the proxy and update the existing axios instance
async function rotateProxy(): Promise<void> {
    currentProxyIndex++;
    if (currentProxyIndex >= proxyList.length) {
        console.log('All proxies exhausted. No more proxy rotation.');
        isRotationPossible = false;
        return;
    }
    console.log(`Rotated ${currentProxyIndex + 1}/${proxyList.length} proxies`);
    setupAxiosInstanceWithProxy(); // Update the existing Axios instance with the new proxy
}

// Function to set up Axios instance with the current proxy
function setupAxiosInstanceWithProxy(): void {
    console.log('Setting up Axios instance with proxy:', proxyList[currentProxyIndex]);
    const httpAgent = new HttpProxyAgent({
        proxy: `http://${proxyList[currentProxyIndex]}`
    })
    const httpsAgent = new HttpsProxyAgent({
        proxy: `https://${proxyList[currentProxyIndex]}`
    })
    axiosInstance = axios.create({
        httpAgent,
        httpsAgent,
        timeout: TIMEOUT
    });

    setupAxiosInterceptors(axiosInstance);

    axiosInstance.get('https://api.ipify.org', {
        headers: { 'User-Agent': fakeUa() },
        timeout: TIMEOUT
    })
    .then(response => {
        console.log('Proxy success:', proxyList[currentProxyIndex], 'IP:', response.data);
    })
    .catch(error => {
        console.error('Proxy failed:', error.message);
    });
}

// Function to queue and manage Puppeteer requests
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
        processPuppeteerQueue(); // Process the queue whenever a new request is added
    });
}


// Function to process the Puppeteer queue
async function processPuppeteerQueue() {
    if (activePuppeteerRequests >= MAX_PUPPETEER_REQUESTS || puppeteerQueue.length === 0) {
        return; // Either max requests are active or the queue is empty
    }

    const puppeteerRequest = puppeteerQueue.shift(); // Get the next request in the queue

    if (puppeteerRequest) {
        activePuppeteerRequests++; // Increment the active request count
        await puppeteerRequest(); // Execute the request
        activePuppeteerRequests--; // Decrement the count when the request is done
        processPuppeteerQueue(); // Recursively process the next request in the queue
    }
}


// Function to fetch content using Puppeteer
async function fetchWithPuppeteer(url: string, useProxy: boolean): Promise<string> {

    const launchOptions: LaunchOptions & BrowserLaunchArgumentOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };

    if (useProxy && proxyList.length > 0) {
        const proxy = `http://${proxyList[currentProxyIndex]}`;
        launchOptions.args.push(`--proxy-server=${proxy}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent(fakeUa());
    await page.setRequestInterception(true)
    page.on('request', (request) => {
        if (request.resourceType() === 'image') request.abort()
        else request.continue()
    })
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const content = await page.content();
        return content;
    } catch (error) {
        console.error('Puppeteer error:', (error as Error).message);
        throw error;
    } finally {
        await browser.close();
        await page.close();
        await page.removeAllListeners();
    }
}

// Function to fetch the HTML content of a URL
async function fetchNetwork(url: string, mode = 'axios', useProxy = false): Promise<string> {
    console.log('Fetching URL:', url, 'Mode:', mode, 'Use proxy:', useProxy);
    if (mode === 'puppeteer') {
        return await queuePuppeteerRequest(url, useProxy);
    }
    try {
        await refreshProxyListIfNeeded();
        const response = await axiosInstance.get(url, {
            headers: { 'User-Agent': fakeUa() },
            timeout: TIMEOUT
        });
        return response.data;

    } catch (error) {
        console.error('Error in fetch:', (error as Error).message);
        throw error;
    }

}

export { fetchNetwork };