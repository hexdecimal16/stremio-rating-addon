import { addonBuilder, Args, ContentType, MetaDetail, serveHTTP } from "stremio-addon-sdk";
import { handleMetaRequest } from "./handlers/metaHandler";
import { trendingCatalog, featuredCataloge, searchCatalog, bestYearByYearCatalog } from "./handlers/catalogHandler";
import manifest from "./manifest";
import dotenv from "dotenv";
import { closeCacheClient, getCacheClient } from "./cache";
import fs from "fs";

dotenv.config();

const builder = new addonBuilder(manifest);

// Catalog Handlers
builder.defineCatalogHandler(async (args: Args) => {
    console.log("CatalogHandler args:", args);
    let cacheClient = await getCacheClient();
    const key = args.id + JSON.stringify(args.extra);
    if (cacheClient != null && !cacheClient.isOpen) {
        console.log("Cache is not open, opening it again");
        cacheClient = await getCacheClient();
    }
    try {
        // Check if the response is cached
        const cachedResponse = await cacheClient?.get(key);
        if (cachedResponse) {
            const response = JSON.parse(cachedResponse);
            return response;
        }
        let response = { metas: [] };
        switch (args.id) {
            case "trending":
                response = await trendingCatalog(args.type, args.extra);
                break;
            case "featured":
                response = await featuredCataloge(args.type, args.extra);
                break;
            case "search":
                response = await searchCatalog(args.type, args.extra);
                break;
            case "best_yoy":
                response = await bestYearByYearCatalog(args.type, args.extra);
                break;
            default:
                response = { metas: [] };
        }

        // Cache the response for 6 hours
        cacheClient?.set(key, JSON.stringify(response));
        cacheClient?.expire(key, 21600);
        return response;
    } catch (error) {
        console.error("Error in CatalogHandler:", error);
        return { metas: [] };
    } finally {
        closeCacheClient();
    }
});

// Meta Handlers
builder.defineMetaHandler(async (args: { type: ContentType, id: string }) => {
    try {
        return { meta: await handleMetaRequest(args.id, args.type) };
    } catch (error) {
        console.error("Error in MetaHandler:", error);
        return { meta: {} as any };
    }
});

// Additional handlers (stream, subtitle, etc.) can be added similarly
const port = Number(process.env.PORT) || 3000;
serveHTTP(builder.getInterface(), { port: port });
console.log(`🚀 Link for addon http://localhost:${port}`);
