# Harbinger Repository Structure

## 📂 Root Directory

```
harbinger/
├── backend/              # Backend API server
├── frontend/             # Frontend application
├── config/               # Configuration files (YAML, JSON)
├── scripts/              # Build and deployment automation
├── types/                # Shared TypeScript type definitions
├── docs/                 # All project documentation
├── tests/                # Test files
├── inactive-files/       # Archived/unused code
├── .github/              # GitHub Actions CI/CD workflows
├── .gitignore
├── README.md             # Project overview
├── STRUCTURE.md          # This file - repository organization
└── package.json          # Root package config & scripts
```

## 🎨 Frontend Structure

```
frontend/
├── src/
│   ├── engine/           # Custom vdom rendering engine
│   │   ├── main.tsx      # TypeScript source
│   │   └── main.js       # Compiled JavaScript
│   │
│   ├── components/       # React-like UI components
│   │   ├── App.js        # Main app container
│   │   ├── LoginForm.js  # Authentication UI
│   │   ├── EditorView.js # Compose new entries
│   │   └── ArchiveView.js # List & reading pane
│   │
│   ├── lib/              # Utilities and libraries
│   │   ├── api.js        # Backend API client
│   │   └── state.js      # Application state management
│   │
│   ├── config/           # Frontend configuration
│   │   └── flags-runtime.js # Runtime config (auto-generated)
│   │
│   ├── data/             # Mock data for development
│   │   └── mock-data.js  # DEV mode fixtures
│   │
│   ├── types/            # Frontend type definitions
│   │   └── journal-messages.js # Message creators
│   │
│   ├── styles/           # CSS styling
│   │   └── journal.css   # 1960s typewriter theme
│   │
│   └── app.js            # Application entry point
│
├── index.html            # HTML template
├── server.js             # Development server
├── build.js              # Production build script
├── esbuild.watch.js      # Dev build configuration
├── esbuild.build.js      # Prod build configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Frontend dependencies
├── BUILD_SYSTEM.md       # Build system documentation
└── COMPONENTS.md         # Component architecture guide
```

## ⚙️ Backend Structure

```
backend/
├── server.js             # Main HTTP server entry point
│
├── config/               # Configuration
│   └── config.js         # Loads flags.json, exports CONFIG
│
├── auth/                 # Authentication
│   └── auth.js           # signup, login, JWT, bcrypt
│
├── db/                   # Database operations
│   └── db.js             # DynamoDB CRUD operations
│
├── lambda.js             # AWS Lambda handler entry point
├── .env.example          # Environment variables template
├── package.json          # Backend dependencies
└── README.md             # Backend documentation
```

## 🔧 Configuration

```
config/
├── flags.yml             # Active configuration (edit this)
├── flags.prod.yml        # Production template (DEV=false)
└── flags.json            # Compiled config (auto-generated, used by backend)
```

## 📜 Scripts

```
scripts/
├── load-config.js        # Converts flags.yml → flags.json + flags-runtime.ts
├── validate-logging.ts   # Type-safe logging validation tool
│
├── deploy/               # Deployment automation
│   ├── deploy.sh         # Manual deployment script
│   └── setup-production.sh # Interactive production setup
│
├── package.json          # Scripts dependencies (yaml parser)
└── tsconfig.json         # TypeScript config for scripts
```

## 📚 Documentation

```
docs/
├── CONFIGURATION.md      # Configuration system guide
├── CONFIG_HOW_IT_WORKS.md # Deep dive into config
├── ARCHITECTURE.md       # System design & architecture
├── HARBINGER.md          # Project philosophy & design
│
├── deployment/           # Deployment guides
│   ├── PRODUCTION_DEPLOY.md  # Comprehensive deployment guide
│   ├── DEPLOY_NOW.md         # Quick 5-minute deploy
│   ├── QUICKSTART_DEPLOY.md  # Step-by-step walkthrough
│   └── DEPLOYMENT.md         # Infrastructure details
│
└── guides/               # Technical guides
    └── LOGGING_GUIDE.md  # Type-safe logging system
```

## 🧬 Types

```
types/
├── types.ts              # Core Message, REGISTERED_NUM_MAP, VISITOR
├── utilities.ts          # LOG_WITH_LEVEL, type-safe utilities
├── FLAGS.ts              # Flag type definitions
├── flags-runtime.ts      # Runtime config (auto-generated)
├── journal-messages.ts   # Message creator functions
│
└── examples/             # Code examples
    └── logging-examples.ts # Logging system examples
```

## 🔍 Import Paths Guide

### Frontend Import Patterns

```javascript
// Engine imports
import { createElement, render } from './engine/main.js';

// Component imports
import { App } from './components/App.js';

// Library imports
import { api, state } from './lib/';

// Configuration
import { CONFIG } from './config/flags-runtime.js';

// Data
import { MOCK_USER } from './data/mock-data.js';

// Types
import { createPostMessage } from './types/journal-messages.js';
```

### Backend Import Patterns

```javascript
// In backend/server.js - import from organized folders
import { config } from './config/config.js';
import { signup, login, extractUser } from './auth/auth.js';
import { createEntry, getUserEntries, deleteEntry } from './db/db.js';

// In backend/db/db.js - import config from parent
import { config } from '../config/config.js';

// In backend/auth/auth.js - import from sibling folders
import { createUser, getUserByEmail } from '../db/db.js';
import { config } from '../config/config.js';
```

### Component Internal Imports

From any component in `src/components/`:

```javascript
import { createElement } from '../engine/main.js';
import { api } from '../lib/api.js';
import { state } from '../lib/state.js';
import { CONFIG } from '../config/flags-runtime.js';
```

## 🎯 Key Principles

### 1. **Clear Separation of Concerns**

**Frontend:**
- **engine/** - Rendering logic only
- **components/** - UI components only
- **lib/** - Shared utilities and state
- **config/** - Configuration only
- **data/** - Test/mock data only

**Backend:**
- **config/** - Configuration loading
- **auth/** - Authentication logic
- **db/** - Database operations

**Root:**
- **types/** - Shared type definitions (TS)
- **scripts/** - Build & deployment automation
- **docs/** - All documentation organized by topic
- **config/** - YAML configuration source of truth

### 2. **Intuitive Naming**
- Folders are plural nouns: `components/`, `types/`, `styles/`
- Folders group related concerns: `auth/`, `db/`, `deployment/`
- Files are descriptive: `api.js`, `state.js`, `flags-runtime.js`
- Components are PascalCase: `App.js`, `LoginForm.js`

### 3. **Minimal Nesting**
- Maximum 2-3 levels deep
- Related files grouped together
- Easy to find any file by category

### 4. **Import Path Clarity**
- Relative imports show relationships
- `./` for same folder, `../` for parent folder
- No `../../..` spaghetti
- Clear parent-child relationships
- Backend folders use semantic grouping: `./auth/auth.js`, `./db/db.js`

### 5. **Documentation Co-location**
- Project docs in `docs/` organized by topic
- Deployment docs in `docs/deployment/`
- Guides in `docs/guides/`
- Module-specific docs next to code (e.g., `frontend/BUILD_SYSTEM.md`)

## 🚀 Development Workflow

### Adding a New Component

1. Create in `src/components/NewComponent.js`
2. Import engine: `from '../engine/main.js'`
3. Import utilities: `from '../lib/api.js'`
4. Export component function

### Adding New Utility

1. Create in `src/lib/utility.js`
2. Export functions
3. Import in components: `from '../lib/utility.js'`

### Updating Configuration

1. Edit `config/flags.yml`
2. Run `npm run load-config`
3. Auto-generates `config/flags.json` and `types/flags-runtime.ts`
4. Frontend imports from `src/config/flags-runtime.js` (copied during build)

### Working on Engine

1. Edit `src/engine/main.tsx`
2. esbuild watch compiles to `src/engine/main.js`
3. Components import compiled version

## 📦 Build Process

```
Development:
  main.tsx → [esbuild watch] → main.js
  Components import from engine/main.js
  Dev server serves files directly

Production:
  1. Copy config/flags.prod.yml → flags.yml
  2. Run load-config (generates flags.json)
  3. Copy flags-runtime.js to frontend/src/config/
  4. esbuild compiles main.tsx → main.js
  5. Copy all files to dist/
  6. Deploy dist/ to Cloudflare Pages
```

## 🧪 Testing Structure

```
tests/
└── (Future location for test files)
```

## 📝 Notes

- **engine/** contains your custom vdom implementation (no React)
- **lib/** is for shared business logic
- **components/** should be pure UI
- **config/** is auto-generated from YAML
- **data/** only used in DEV mode
- All imports use relative paths for clarity
- No circular dependencies

## 🔄 Migration from Old Structure

### Changed Locations

#### Frontend
| Old Path | New Path |
|----------|----------|
| `src/main.tsx` | `src/engine/main.tsx` |
| `src/api.js` | `src/lib/api.js` |
| `src/components/state.js` | `src/lib/state.js` |
| `src/flags-runtime.js` | `src/config/flags-runtime.js` |
| `src/mock-data.js` | `src/data/mock-data.js` |
| `src/journal-messages.js` | `src/types/journal-messages.js` |
| `src/journal.css` | `src/styles/journal.css` |

#### Backend
| Old Path | New Path |
|----------|----------|
| `backend/config.js` | `backend/config/config.js` |
| `backend/auth.js` | `backend/auth/auth.js` |
| `backend/db.js` | `backend/db/db.js` |

#### Types
| Old Path | New Path |
|----------|----------|
| `types/logging-examples.ts` | `types/examples/logging-examples.ts` |
| `types/LOGGING_GUIDE.md` | `docs/guides/LOGGING_GUIDE.md` |

#### Scripts
| Old Path | New Path |
|----------|----------|
| `scripts/deploy.sh` | `scripts/deploy/deploy.sh` |
| `scripts/setup-production.sh` | `scripts/deploy/setup-production.sh` |

#### Documentation
| Old Path | New Path |
|----------|----------|
| `ARCHITECTURE.md` | `docs/ARCHITECTURE.md` |
| `HARBINGER.md` | `docs/HARBINGER.md` |
| `PRODUCTION_DEPLOY.md` | `docs/deployment/PRODUCTION_DEPLOY.md` |
| `DEPLOY_NOW.md` | `docs/deployment/DEPLOY_NOW.md` |
| `QUICKSTART_DEPLOY.md` | `docs/deployment/QUICKSTART_DEPLOY.md` |
| `DEPLOYMENT.md` | `docs/deployment/DEPLOYMENT.md` |

#### Archived
| Old Path | New Path |
|----------|----------|
| `main.js` | `inactive-files/main.js` |

### Import Updates

All imports automatically updated to reflect new structure. Files now clearly show their dependencies and relationships through import paths.
