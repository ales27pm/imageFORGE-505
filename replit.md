# imageFORGE - AI Image Generation App

## Overview
imageFORGE is an Expo/React Native cross-platform app that allows users to generate AI images from text prompts. The app is built with Expo Router and React Native for web deployment.

## Project Structure
- `app/` - Main application code using Expo Router file-based routing
  - `(tabs)/` - Tab-based navigation (Create, Gallery)
  - `_layout.tsx` - Root layout component
  - `modal.tsx` - Modal screens
- `assets/` - Static assets (images, icons)
- `constants/` - App constants and configuration
- `contexts/` - React contexts for state management
- `types/` - TypeScript type definitions

## Technologies
- **Framework**: Expo SDK 54 + React Native 0.81
- **Routing**: Expo Router 6
- **Language**: TypeScript
- **Package Manager**: Bun
- **State Management**: Zustand
- **Icons**: Lucide React Native
- **AI Integration**: @rork-ai/toolkit-sdk

## Development
The app is configured to run as a static web build served on port 5000.

### Scripts
- `bun run dev` - Serve the static build on port 5000
- `bun run build:web` - Export the web build to `dist/` folder
- `bun run start` - Start the original Rork development server with tunneling

### Important Notes
1. The Metro bundler has file handle limitations on Replit. To work around this, the app runs as a static export served by the `serve` package.
2. When making changes, you need to rebuild with `bun run build:web` and restart the workflow.
3. The app uses the Rork AI toolkit for image generation features.

## Deployment
The app is configured for static deployment. The `dist/` folder contains the production build.

## Recent Changes
- 2026-01-28: Fixed Expo FileSystem API migration
  - Migrated from deprecated `expo-file-system/legacy` to modern Expo FileSystem API
  - Added `base64ToUint8Array` helper to convert base64 to binary Uint8Array
  - Updated file writes to use `file.create()` + `file.write(bytes)` pattern
  - Fixed async directory operations with proper await calls
  - Fixed blank image problem in Gallery and Generate screens
- 2026-01-28: Initial setup for Replit environment
  - Configured static web export and serve workflow
  - Set up port 5000 for web preview
  - Added metro.config.js customizations for cache control
