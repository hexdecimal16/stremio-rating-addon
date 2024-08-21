import { ManifestConfig } from "stremio-addon-sdk"

export const Providers: ManifestConfig[] = [{
    key: 'providers',
    title: 'Select Providers to Fetch Ratings From',
    type: 'multiselect' as any,
    options: ["imdb", "rotten_tomatoes", "metacritic", "crunchyroll", "filmaffinity", "all"] as any,
    default: 'all',
    required: true as any
}]