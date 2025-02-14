import * as esbuild from 'esbuild';
// it's no use now cause i switched to bun build
async function build(){
    const res=await esbuild.build({
        entryPoints:[{in:"cli.ts",out:"qmcli"}],
        outdir:"dist",
        minify: true,
        bundle: true,
        platform:"node",
        outExtension:{".js":".cjs"},
        banner:{js:"#!/usr/bin/env node"}
    });
    console.log(res);
    await esbuild.stop();
}
await build();