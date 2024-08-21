import { Manifest } from "stremio-addon-sdk";
import { Providers } from "./utils/filter";

const manifest: Manifest = {
    id: "org.stremio.ratings",
    version: "1.0.0",
    name: "Ratings from Multiple Sources",
    description: "Adds ratings from IMDb, Rotten Tomatoes, Metacritic, Crunchyroll, Filmaffinity, Gadgets 360, and others to description and poster in Stremio.",
    resources: [
        "catalog",
        "meta"
    ],
    types: [
        "movie",
        "series"
    ],
    idPrefixes: [
        "tt"
    ],
    catalogs: [
        {
            id: "trending",
            name: "Trending",
            type: "movie",
            extra: [
                {
                    name: "genre",
                    isRequired: false,
                    options: [
                        "Action",
                        "Adventure",
                        "Animation",
                        "Biography",
                        "Comedy",
                        "Crime",
                        "Documentary",
                        "Drama",
                        "Family",
                        "Fantasy",
                        "History",
                        "Horror",
                        "Musical",
                        "Mystery",
                        "Romance",
                        "Sci-Fi",
                        "Sport",
                        "Thriller",
                    ]
                }
            ]
        },
        {
            id: "trending",
            name: "Trending",
            type: "series",
            extra: [
                {
                    name: "genre",
                    isRequired: false,
                    options: [
                        "Action",
                        "Adventure",
                        "Animation",
                        "Biography",
                        "Comedy",
                        "Crime",
                        "Documentary",
                        "Drama",
                        "Family",
                        "Fantasy",
                        "History",
                        "Horror",
                        "Musical",
                        "Mystery",
                        "Romance",
                        "Sci-Fi",
                        "Sport",
                        "Thriller",
                    ]
                }
            ]
        },
        {
            id: "featured",
            name: "Featured",
            type: "movie",
            extra: [
                {
                    name: "genre",
                    isRequired: false,
                    options: [
                        "Action",
                        "Adventure",
                        "Animation",
                        "Biography",
                        "Comedy",
                        "Crime",
                        "Documentary",
                        "Drama",
                        "Family",
                        "Fantasy",
                        "History",
                        "Horror",
                        "Musical",
                        "Mystery",
                        "Romance",
                        "Sci-Fi",
                        "Sport",
                        "Thriller",
                    ]
                }
            ]
        },
        {
            id: "featured",
            name: "Featured",
            type: "series",
            extra: [
                {
                    name: "genre",
                    isRequired: false,
                    options: [
                        "Action",
                        "Adventure",
                        "Animation",
                        "Biography",
                        "Comedy",
                        "Crime",
                        "Documentary",
                        "Drama",
                        "Family",
                        "Fantasy",
                        "History",
                        "Horror",
                        "Musical",
                        "Mystery",
                        "Romance",
                        "Sci-Fi",
                        "Sport",
                        "Thriller",
                    ]
                }
            ]
        },
        {
            id: "search",
            name: "Search",
            type: "movie",
            extra: [
                {
                    name: "search",
                    isRequired: true
                }
            ]
        },
        {
            id: "search",
            name: "Search",
            type: "series",
            extra: [
                {
                    name: "search",
                    isRequired: true
                }
            ]
        },
        {
            id: "best_yoy",
            name: "Best of the Year",
            type: "movie",
            extra: [
                {
                    name: "genre",
                    isRequired: true,
                    // generate options from the list of genres from current year to 2000
                    options: Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => (new Date().getFullYear() - i).toString())
                }
            ]
        },
        {
            id: "best_yoy",
            name: "Best of the Year",
            type: "series",
            extra: [
                {
                    name: "genre",
                    isRequired: true,
                    // generate options from the list of genres from current year to 2000
                    options: Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => (new Date().getFullYear() - i).toString())
                }
            ]
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: true,
    },
    config: Providers,
};


export default manifest;