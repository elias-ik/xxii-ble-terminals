# XXII BLE Terminals

This is a React project with Electron integration for desktop application development.

## Development

### React Development
```bash
npm run dev          # Start React development server
npm run build        # Build for production
npm run start        # Serve production build
```

### Electron Development
```bash
npm run electron:dev         # Start React dev server + Electron (recommended)
npm run electron:dev:simple  # Alternative development setup
npm run electron:build       # Build Electron app for distribution
npm run electron:serve       # Serve built app with Electron
```

## Electron Setup

This project is configured to run your React app inside an Electron window. The setup includes:

- **Development**: Electron loads the React app from the Vite dev server (http://localhost:5173)
- **Production**: Electron loads the built React app from the `dist` directory
- **Hot Reload**: Changes in your React code will automatically reload in the Electron window during development

### Key Files
- `main.js` - Electron main process configuration
- `vite.config.ts` - Vite configuration for Electron compatibility
- `dev-electron.js` - Development script for starting both React and Electron

### Building for Distribution
```bash
npm run electron:build
```

This will create distributable packages in the `release` directory for your platform (macOS, Windows, Linux).




for the framing have a option to create two different delimiters for start and end depening if its a received vs sent message

so in the same line in the framing, have right bound have a toggle switch for deciding if you want to have seperate chars for sendind and receiving or 