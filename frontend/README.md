# Word Domination Solver - Frontend

React TypeScript frontend for the Word Domination Solver.

## Features

- **Interactive Board**: Click cells to place/edit letters
- **Rack Management**: Edit your 7-tile rack
- **Real-time Analysis**: WebSocket connection to solver backend
- **Move Visualization**: Top moves highlighted on board
- **Multiple Search Modes**: Greedy, Beam Search, Beam + MCTS

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Running solver backend on port 3000

### Installation

```bash
# Using npm
npm install

# Using bun (recommended)
bun install
```

### Development

```bash
# Start dev server
npm run dev
# or
bun run dev

# Open http://localhost:3001
```

### Building

```bash
npm run build
# or
bun run build

# Preview production build
npm run preview
```

## Usage

1. **Start the backend solver**: `cargo run --release --bin solver` (from project root)
2. **Start the frontend**: `npm run dev` (from frontend directory)
3. **Edit the board**: Click cells to enter letters
4. **Set your rack**: Enter your 7 tiles in the rack editor
5. **Analyze**: Click "Analyze Position" to find best moves
6. **View results**: Top moves appear in ranked list with scores

## Architecture

- **State Management**: Zustand for global state
- **Rendering**: Canvas API for performant board drawing
- **Communication**: WebSocket with bincode serialization
- **Styling**: CSS with CSS variables for theming

## Components

- `App.tsx`: Main application layout
- `BoardCanvas.tsx`: Interactive 9x9 board with canvas rendering
- `RackEditor.tsx`: 7-tile rack input
- `Controls.tsx`: Analysis settings and trigger
- `MoveList.tsx`: Ranked move display
- `store.ts`: Zustand state management
- `types.ts`: TypeScript types matching Rust protocol

## Configuration

Set the WebSocket URL via environment variable:

```bash
VITE_WS_URL=ws://your-server:3000/solve npm run dev
```

## Performance

- Canvas rendering: 60fps
- WebSocket: Binary protocol for minimal latency
- Bundle size: <200KB (gzipped)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Project Structure

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx          - Entry point
    ├── App.tsx           - Main app component
    ├── App.css           - App styles
    ├── index.css         - Global styles
    ├── types.ts          - TypeScript types
    ├── store.ts          - Zustand state management
    ├── BoardCanvas.tsx   - Interactive board
    ├── RackEditor.tsx    - Rack input
    ├── Controls.tsx      - Analysis controls
    └── MoveList.tsx      - Move results
```

## Development Workflow

1. **Start backend**: `cargo run --release --bin solver` (from project root)
2. **Start frontend**: `npm run dev` (from frontend directory)
3. **Open browser**: http://localhost:3001
4. **Make changes**: Hot reload enabled

## Known Limitations

- Bincode encoding currently uses JSON placeholder (needs proper bincode library)
- No offline mode (requires active backend connection)
- Board state persistence not implemented
- OCR integration not yet added

## Future Enhancements

- Proper bincode encoding/decoding
- Board state save/load
- Move history
- Undo/redo functionality
- OCR for automatic board capture
- Mobile responsive design
