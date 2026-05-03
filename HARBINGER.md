# HARBINGER
## A Journal of Thought

### 1960s Typewriter Aesthetic

Minimalist journal editor inspired by mid-century editorial design.

## Features

- **COMPOSE** - Write new entries with typewriter interface
- **ARCHIVE** - Browse all published entries
- **Message-based architecture** - All operations flow through your VISITOR/Message system

## Design Philosophy

- Monospace Courier typography
- Black & white brutalist aesthetic  
- Paper texture (#f4f1e8)
- No rounded corners, no gradients
- Focus on the written word

## Usage

```bash
# Start backend
cd backend
npm run dev

# Open frontend
open frontend/index.html
```

## Architecture

Built on your custom vdom engine with Message-based API:
- Login → `auth_login` message (val: 21)
- Compose → `create_post` message (val: 10)  
- Archive → `get_posts` message (val: 11)
- Delete → `delete_post` message (val: 14)

All operations validated through REGISTERED_NUM_MAP.

## Admin Interface

As admin, you have full CRUD:
- Write daily entries
- View chronological archive
- Delete records

The interface is intentionally minimal - just you and the page.
