# bullmq-ui

<img width="2584" height="489" alt="image" src="https://github.com/user-attachments/assets/d43147d6-498d-4c9a-9257-e3f625e11c0b" />

A modern, real-time monitoring dashboard for BullMQ

## Features

- 🔮 **Predictive Insights** - Get warnings before issues occur, not after
- 📊 **Multi-Queue Monitoring** - Monitor multiple BullMQ queues simultaneously
- 🎯 **Job Status Tracking** - View jobs by status (latest, waiting, waiting-children, active, completed, failed, delayed, prioritized)
- 🔍 **Job Details** - Detailed view of job data, options, logs, errors, and results

## Prerequisites

- Node.js 22+ or Bun
- Redis server running
- BullMQ queues set up in your application (see [BullMQ simulator](https://github.com/quanghuynt14/bullmq-simulator))

# Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env and configure your Redis connection and queue names
vi .env

# Run the application
pnpm dev
```

The dashboard will be available at `http://localhost:3000`

## Configuration

Edit the `.env` file to configure your Redis connection and queue names:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
pnpm lint
pnpm format
pnpm check
```

## Contributing

Feel free to open issues or submit pull requests if you encounter any bugs or have suggestions for improvements. Your contributions are welcome!

## License

MIT
