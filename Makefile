SHELL := /bin/zsh

.PHONY: help start start-local verify test unit harness contract smoke camera-devices

help:
	@printf '%s\n' \
		'Targets:' \
		'  make start          Start the Telegram Bot using the current environment' \
		'  make start-local    Load .env.local and start the Telegram Bot' \
		'  make verify         Run the full repository verification suite' \
		'  make test           Run unit, harness, contract, and smoke tests' \
		'  make unit           Run unit tests' \
		'  make harness        Run harness tests' \
		'  make contract       Run contract tests' \
		'  make smoke          Run smoke checks' \
		'  make camera-devices List macOS AVFoundation camera devices'

start:
	@npm run start

start-local:
	@set -a; \
	source .env.local; \
	set +a; \
	npm run start

verify:
	@./init.sh

test: unit harness contract smoke

unit:
	@npm run test:unit

harness:
	@npm run test:harness

contract:
	@npm run test:contract

smoke:
	@npm run smoke

camera-devices:
	@ffmpeg -f avfoundation -list_devices true -i ""
