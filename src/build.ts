import { Leaf } from "https://deno.land/x/leaf@v1.0.4/mod.ts";

Leaf.compile({
    modulePath: "./main.ts",
    contentFolders: ["./embed-views", "./embed-public"],
    output: 'roomswap'
});