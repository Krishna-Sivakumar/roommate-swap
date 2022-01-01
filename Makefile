build:
	deno compile -o roomswap --allow-all --unstable src/main.ts

dev:
	sh -c 'source ./.env.test && deno run --no-check --allow-all --unstable src/main.ts'

start:
	deno run --unstable --allow-all src/main.ts

startsilent:
	deno run --unstable --allow-all src/main.ts > /dev/null