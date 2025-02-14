import zl from "zip-lib";
import * as fs from "node:fs";
const typebuild = Bun.argv[Bun.argv.length - 1];
async function buildCjs() {
    await Bun.build({
        entrypoints: ["cli.ts"],
        target: "node",
        minify: true,
        banner: "#!/usr/bin/env node",
        outdir: "./dist",
        naming: "[dir]/qmcli.cjs",
    });
}

function buildForPlatform(platform: string) {
    Bun.spawnSync({
        stdio: ["ignore", "inherit", "inherit"],
        cwd: "./dist",
        cmd: [
            "bun",
            "build",
            "--compile",
            "--target",
            `bun-${platform}`,
            "qmcli.cjs",
            "--outfile",
            `buildexe/${platform}/qmcli`,
        ],
    });
}

async function buildAllExe() {
    await buildCjs();
    console.log("cjs built");
    const platforms=[
        "windows-x64","linux-x64","linux-arm64","darwin-x64","darwin-arm64"
    ];
    fs.mkdirSync("./dist/build",{recursive:true});
    fs.mkdirSync("./dist/buildexe",{recursive:true});
    for (const platform of platforms) {
        buildForPlatform(platform);
        // look for file under dist/buildexe/${platform}/
        let file=fs.readdirSync(`./dist/buildexe/${platform}`).filter((f)=>f.startsWith("qmcli"))[0];
        if(!file){
            console.error(`file not found in ./dist/buildexe/${platform}/`);
            process.exit(1);
        }
        // zip them
        await zl.archiveFile(`./dist/buildexe/${platform}/${file}`,`./dist/build/qmcli-${platform}.zip`);
        console.log(`${platform} built`)
    }
    for(const platform of platforms){
        console.log(`dist/build/qmcli-${platform}.zip`)
    }
}

if (typebuild == "cjs") {
    buildCjs().then(() => {
        console.info("build success");
    }).catch((e) => {
        throw e;
    });
} else if (typebuild == "exe") {
    buildAllExe().then(() => {
        console.info("build success");
    }).catch((e) => {
        throw e;
    });
}
