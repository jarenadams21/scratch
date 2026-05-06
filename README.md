# Minimal Virtual DOM
Hello
## Foundation created from
> https://pomb.us/build-your-own-react/

## HARBINGER - Journal of Thought

Personal journal built with custom vdom engine + DynamoDB + Lambda + Cloudflare

### Quick Start

```bash
npm run dev (implicit ```node server.js``` and ```tsc``` call)
```

Opens:
- Frontend: http://localhost:8080
- Backend: http://localhost:3000

### Stack
- **Frontend**: Fiber-based vdom engine, Message architecture
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