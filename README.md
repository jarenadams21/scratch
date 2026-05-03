# Minimal Virtual DOM
Hello
## Foundation created from
> https://pomb.us/build-your-own-react/
### Steps
    > terminal 1: npm run dev (implicit ```node server.js``` and ```tsc``` call)
#### todo
    1. Implement types for main.tsx implementation simplification (e.g., types/react)
    2. Comment cleanup (they were auto gen'd)

---

## HARBINGER - Journal of Thought

Personal journal built with custom vdom engine + DynamoDB + Cloudflare Pages.

### Quick Start

```bash
npm run dev
```

Opens:
- Frontend: http://localhost:8080
- Backend: http://localhost:3000

See [START.md](START.md) for details.

### Stack
- **Frontend**: Custom vdom engine, Message architecture
- **Backend**: Node.js HTTP server with JWT auth
- **Database**: DynamoDB (or mock data in DEV mode)
- **Auth**: bcrypt + JWT
- **Config**: YAML-driven flags in `config/`

### Key Features
- 1960s typewriter aesthetic
- Message-based CRUD operations
- DEV mode with auto-login and mock data
- YAML configuration system
- Type-safe logging pipeline

### Documentation
- [START.md](START.md) - Quick start
- [RUNNING.md](RUNNING.md) - Full commands
- [CONFIGURATION.md](docs/CONFIGURATION.md) - Config system
- [ARCHITECTURE.md](ARCHITECTURE.md) - Message architecture
- [HARBINGER.md](HARBINGER.md) - Design philosophy

**Cost**: ~$0/month + $9/year domain