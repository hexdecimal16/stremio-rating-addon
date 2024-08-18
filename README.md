# Stremio Addon with Multiple Ratings

This Stremio addon fetches and displays ratings from multiple sources like IMDb, Rotten Tomatoes, Metacritic, Crunchyroll, Filmaffinity, and Gadgets 360, adding them to movie and series posters in the Stremio app.

## Features

- Fetch ratings from multiple sources.
- Overlay ratings on posters.
- Support for trending and discover catalogs.

## Screenshots

![Screenshot 1](https://github.com/hexdecimal16/stremio-rating-addon/blob/main/assets/screenshot1.png)

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your system.
- [Docker](https://www.docker.com/) installed on your system.

### Running the Application Locally

1. Clone the repository:

    ```bash
    git clone https://github.com/hexdecimal16/stremio-rating-addon.git
    cd stremio-rating-addon
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

    or

    ```bash
    yarn install
    ```

3. Start the application:

    ```bash
    npm start
    ```

    or

    ```bash
    yarn start
    ```

4. Access the application at `http://localhost:3000`.

### Running the Application with Docker

To run the application inside a Docker container, follow these steps:

1. **Build the Docker image:**

    Navigate to the directory containing the `Dockerfile` and run:

    ```bash
    docker build -t stremio-rating-addon .
    ```

2. **Run the Docker container:**

    Once the image is built, run the container, mapping port 3000 of the container to port 3000 on your host machine:

    ```bash
    docker run -d -p 3000:3000 stremio-rating-addon
    ```

3. **Verify the container is running:**

    You can check if the container is running by using:

    ```bash
    docker ps
    ```

4. **Access the application:**

    Open your browser and navigate to `http://localhost:3000` to access the Stremio addon.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue to contribute.
