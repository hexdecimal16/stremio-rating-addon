// src/network/index.ts
import { axiosInstance } from './axiosConfig';
import { queuePuppeteerRequest } from './puppeteerConfig';
import { refreshProxyListIfNeeded } from './proxy';
import fakeUa from 'fake-useragent';
import { NETWORK_TIMEOUT } from '../constants/costants';
import axios from 'axios';

async function fetchNetwork(url: string, mode = 'axios', useProxy = false): Promise<string> {
    console.log('Fetching URL:', url, 'Mode:', mode, 'Use proxy:', useProxy);

    if (mode === 'puppeteer') {
        return await queuePuppeteerRequest(url, useProxy);
    }

    if (!useProxy) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': fakeUa() },
                timeout: NETWORK_TIMEOUT
            });
            return response.data;
        } catch (error) {
            console.error('Error in fetch:', (error as Error).message);
            throw error;
        }
    }
    try {
        await refreshProxyListIfNeeded();
        const response = await axiosInstance.get(url, {
            headers: { 'User-Agent': fakeUa() },
            timeout: NETWORK_TIMEOUT
        });
        return response.data;
    } catch (error) {
        console.error('Error in fetch:', (error as Error).message);
        throw error;
    }
}

export { fetchNetwork };
