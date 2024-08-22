import { ManifestConfig } from "stremio-addon-sdk"

export const Providers: ManifestConfig[] = [{
    key: 'providers',
    title: 'Select Providers to Fetch Ratings From',
    type: 'multiselect' as any,
    options: [
        "all",
        "imdb",
        "rotten_tomatoes",
        "metacritic",
        "crunchyroll",
        "filmaffinity",
        "times of india",
        "common sense media",
        "peacock",
        "fandango",
        "ign",
        "flick_filosopher",
    ] as any,
    default: 'all',
    required: true as any
}]