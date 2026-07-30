# .afila

`.afila` is a local desktop application for practicing programming through
daily challenges, immediate feedback, and iterative problem solving.

## Status

The project is currently in the initial MVP development stage.

## Requirements

- Node.js 24
- pnpm 10

## Repository structure

```text
apps/       Executable applications
packages/   Shared internal packages
content/    Bundled exercise content
docs/       Architecture and technical decisions
```

## Development

Install dependencies:

```bash
pnpm install
```

Start the desktop application:

```bash
pnpm dev
```

## Validation

```bash
pnpm verify:electron
pnpm lint
pnpm typecheck
pnpm build
```

## Local macOS package

```bash
pnpm build:unpack
```

## License

MIT License. See [LICENSE](LICENSE) for details.
