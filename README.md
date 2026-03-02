# Printshop App

A Node.js/Express-based printshop application with payment integration.

## Features

- Payment processing with Cashfree API
- PDF handling
- Express server
- MongoDB integration

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB server (either local or hosted)
  - **Important:** the app uses Mongoose to connect to a MongoDB instance; pointing the URI at a file like `data.db` won’t magically create a database.
  - To run a local server you can install MongoDB and start `mongod --dbpath ./data.db`, or simply run a container (`docker run -p 27017:27017 -v $(pwd)/data.db:/data/db -d mongo`).
  - Alternatively use a cloud provider (Atlas, etc.) and set `MONGODB_URI` accordingly.

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd printshop
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server
```bash
npm start
```

The application will be running on `http://localhost:3000`

## Project Structure

```
src/
├── server.js          # Main application entry point
├── api/               # API-related code (Cashfree integration)
├── config/            # Configuration files
└── utils/             # Utility functions

public/                # Static files (HTML, CSS, JavaScript)
tests/                 # Test files
instance/              # Instance-specific configuration
```

## Available Scripts

- `npm start` - Start the server
- `npm test` - Run tests

## Deployment

### GitHub Pages Deployment

This project is configured to deploy automatically to GitHub Pages using GitHub Actions.

1.  **Hosting the Backend**: Host your `server.js` on a service like [Render](https://render.com/) or [Railway](https://railway.app/).
2.  **Update API Base**: In `index.html`, update the `window.API_BASE` variable with your hosted backend URL:
    ```html
    <script>
      window.API_BASE = 'https://your-backend-url.com';
    </script>
    ```
3.  **GitHub Setup**:
    - Push your code to the `main` branch of a GitHub repository.
    - The included [GitHub Action](.github/workflows/deploy.yml) will automatically create and update a `gh-pages` branch.
    - Go to your repository **Settings** > **Pages**.
    - Under **Build and deployment** > **Branch**, select `gh-pages` and the `/(root)` folder.
    - Click **Save**. Your site will be live at `https://<your-username>.github.io/<repository-name>/`.

### Local Development

Railway offers a free tier suitable for hobby or development use. To deploy this repository's backend:

1. Go to https://railway.app and log in or sign up.
2. Create a new project and choose **Deploy from GitHub**.
3. Select the `printshop-main` repository and allow Railway to access it.
4. Railway will detect the Node project automatically. It will use the `start` script defined in `package.json` (`node server.js`).
5. In the project dashboard, under **Variables**, set the following environment variables:
   - `MONGODB_URI` – connection string for MongoDB (Atlas is fine).
   - `CASHFREE_APP_ID` and `CASHFREE_SECRET` – credentials for the payment gateway.
   - `PORT` is optional (Railway provides one automatically).
6. Deploy the project; Railway will show a public URL such as `https://your-app.up.railway.app`.

> **Note:** Railway's filesystem is ephemeral. Any files uploaded by users will be lost when the service restarts or redeploys. For production, integrate an external storage service (Amazon S3, Google Cloud Storage, etc.) and update the code accordingly.

### Local Development

Follow the earlier instructions under **Installation**. You can also run `npm run dev` if you install a tool like `nodemon` to reload on changes.

## License

ISC
