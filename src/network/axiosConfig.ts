// src/network/axiosConfig.ts
import axios, { AxiosInstance } from 'axios';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { getCurrentProxy, isProxyRotationPossible, rotateProxy } from './proxy';
import { NETWORK_TIMEOUT } from '../constants/costants';


let axiosInstance: AxiosInstance = axios.create({ timeout: NETWORK_TIMEOUT });

function setupAxiosInterceptors(axiosInstance: AxiosInstance): AxiosInstance {
    axiosInstance.interceptors.response.use(
        response => response,
        async error => {
            console.error('Axios error:', error.code, error.message);
            if (['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_BAD_REQUEST'].includes(error.code) || error.code == undefined) {
                console.warn('Request failed, rotating proxy...');
                return isProxyRotationPossible() ? rotateProxyAndRetry(error) : Promise.reject(error);
            }
            return Promise.reject(error);
        }
    );

    return axiosInstance;
}

async function rotateProxyAndRetry(error: any): Promise<any> {
    await rotateProxy();
    setupAxiosInstanceWithProxy(); // Update the existing Axios instance with the new proxy
    const config = error.config;
    return axiosInstance(config);
}

function setupAxiosInstanceWithProxy(): void {
    const proxy = getCurrentProxy();
    if (proxy) {
        console.log('Setting up Axios instance with proxy:', proxy);
        const httpAgent = new HttpProxyAgent({ proxy: `http://${proxy}` });
        const httpsAgent = new HttpsProxyAgent({ proxy: `https://${proxy}` });
        axiosInstance = axios.create({
            httpAgent,
            httpsAgent,
            timeout: NETWORK_TIMEOUT
        });
        setupAxiosInterceptors(axiosInstance);
    }
}

export { axiosInstance };
