# Test Plan

- `npm run build` checks JavaScript syntax.
- `npm run test:unit` runs unit tests for config, commands, runtime state, camera capture, and transport helpers.
- `npm run test:harness` runs polling and app integration tests with fake Telegram and fake capture.
- `npm run test:contract` verifies command surface and durable state files.
- `npm run smoke` verifies startup with fake configuration.
- `./init.sh` runs the full verification sequence.
