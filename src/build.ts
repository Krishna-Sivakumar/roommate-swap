import { Leaf } from "https://deno.land/x/leaf@v1.0.2/mod.ts";

Leaf.compile({
    modulePath: "./main.ts",
    contentFolders: ["./views", "./public"]
})