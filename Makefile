build:
	deno compile -o roomswap --allow-all --unstable src/main.ts

dev:
	sh -c 'source ./.env.test && deno run --no-check --allow-all --unstable src/main.ts'
