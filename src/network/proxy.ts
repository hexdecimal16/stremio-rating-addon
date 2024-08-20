// src/network/proxy.ts
import axios from 'axios';
import fakeUa from 'fake-useragent';

let proxyList: string[] = [];
let currentProxyIndex = 0;
let lastProxyFetchTime = 0;
const proxyFetchInterval = 60 * 60 * 1000; // 1 hour
let isFetchingProxies = false;
let isRotationPossible = true;
const PROXY_LIST_LIMIT = 100; // Maximum number of proxies to fetch

const TIMEOUT = 2000; // Timeout for network requests in milliseconds

export async function fetchProxyList(): Promise<void> {
    if (isFetchingProxies) {
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

export async function refreshProxyListIfNeeded(): Promise<void> {
    if (Date.now() - lastProxyFetchTime > proxyFetchInterval || proxyList.length === 0) {
        await fetchProxyList();
    }
}

export async function rotateProxy(): Promise<void> {
    currentProxyIndex++;
    if (currentProxyIndex >= proxyList.length) {
        console.log('All proxies exhausted. No more proxy rotation.');
        isRotationPossible = false;
        return;
    }
    console.log(`Rotated ${currentProxyIndex + 1}/${proxyList.length} proxies`);
}

export function getCurrentProxy(): string | null {
    return proxyList[currentProxyIndex] || null;
}

export function isProxyRotationPossible(): boolean {
    return isRotationPossible;
}
