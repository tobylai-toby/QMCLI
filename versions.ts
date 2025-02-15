import chalk from "chalk";
import { config } from "./config";
import { DownloadQueue, DownloadTask } from "./downloader";
import { m } from "./mirrors";
import * as fs from "node:fs";
import * as nodePath from "node:path";
import McLauncherProfiles from "./mc/launcher_profiles.json";
import { checkRules, getArchSuffix, getOs } from "./utils";
// import zl from "zip-lib";
import AdmZip from "adm-zip";
import jsSHA from "jssha";
import { spawn, spawnSync } from "node:child_process";
import arch from "arch";
import { platform, release, version } from "node:os";
import McLog4j2Xml from "./mc/log4j2.xml";
import { select } from "@inquirer/prompts";
import { getUsers } from "./users";
import { t } from "./translations/translate";
import packageJson from "./package.json"

export interface MCVersion {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
}

export async function getVersions(): Promise<MCVersion[]> {
    const verUrl = m(
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    );
    const resp = await fetch(verUrl);
    const data = await resp.json();
    return data.versions;
}

function createPathIfNotExists(path: string) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

export async function fetchAsset(verInfo: any, path: string, gameName: string) {
    // will check and download new assets
    const { assets, assetIndex } = verInfo;
    let totalSize = 0;
    const assetIndexContent = await (await fetch(m(assetIndex.url))).json();
    createPathIfNotExists(`${path}/assets/indexes`);
    createPathIfNotExists(`${path}/assets/objects`);
    createPathIfNotExists(`${path}/assets/virtual`);
    createPathIfNotExists(`${path}/assets/skins`);
    fs.writeFileSync(
        `${path}/assets/indexes/${assetIndex.id}.json`,
        JSON.stringify(assetIndexContent),
    );
    const tasks: DownloadTask[] = [];
    const legacy = assetIndex.id === "legacy";
    for (const name in assetIndexContent.objects) {
        const hash = assetIndexContent.objects[name].hash;
        const url = m(
            `https://resources.download.minecraft.net/${
                hash.substring(0, 2)
            }/${hash}`,
        );
        const file = legacy
            ? `${path}/assets/virtual/legacy/${name}`
            : `${path}/assets/objects/${hash.substring(0, 2)}/${hash}`;
        if (fs.existsSync(file)) {
            // check sha1 of existing file
            const content: Uint8Array = new Uint8Array(fs.readFileSync(file));
            const sha1 = new jsSHA("SHA-1", "UINT8ARRAY").update(content)
                .getHash("HEX");
            if (sha1 !== assetIndexContent.objects[name].hash) {
                console.log(
                    chalk.yellow(t("asset_hash_mismatch_redownload",name)),
                );
            }
        }
        createPathIfNotExists(nodePath.dirname(file));
        tasks.push({
            url,
            filename: file,
            extra: { size: assetIndexContent.objects[name].size },
        });
        totalSize += assetIndexContent.objects[name].size;
    }
    return {
        tasks,
        totalSize,
    };
}

export async function downloadVersion(
    verUrl: string,
    basepath: string,
    gameName: string,
): Promise<void> {
    const versionPath = `${basepath}/versions/${gameName}`;
    createPathIfNotExists(versionPath);
    const verInfo = await (await fetch(verUrl)).json();
    fs.writeFileSync(
        `${versionPath}/${gameName}.json`,
        JSON.stringify(verInfo),
    );
    const tasks: DownloadTask[] = [];
    const assets = await fetchAsset(verInfo, basepath, gameName);
    let totalSize = assets.totalSize;
    // assetsIndex json
    tasks.push(...assets.tasks);
    // client.jar
    const { downloads: { client } } = verInfo;
    tasks.push({
        url: client.url,
        filename: `${versionPath}/${gameName}.jar`,
        extra: { size: client.size },
    });
    totalSize += client.size;
    // libraries
    createPathIfNotExists(`${basepath}/libraries`);
    for (const lib of verInfo.libraries) {
        const { downloads: { artifact } } = lib;
        if (artifact) {
            const { path, url, size } = artifact;
            tasks.push({
                url: m(url),
                filename: `${basepath}/libraries/${path}`,
                extra: { size },
            });
            totalSize += size;
            createPathIfNotExists(
                nodePath.dirname(`${basepath}/libraries/${path}`),
            );
        }
        // if have classifiers
        if (lib.downloads.classifiers) {
            for (
                const [key, val] of Object.entries<any>(
                    lib.downloads.classifiers,
                )
            ) {
                const { path, url, size } = val;
                createPathIfNotExists(
                    nodePath.dirname(`${basepath}/libraries/${path}`),
                );
                tasks.push({
                    url: m(url),
                    filename: `${basepath}/libraries/${path}`,
                    extra: { size },
                });
                totalSize += size;
            }
        }
    }
    // logging
    // will use custom log4j2.xml
    // if (verInfo.logging?.client?.file?.id) {
    //     const { logging: { client: { file: { id, sha1, size, url } } } } =
    //         verInfo;
    //     tasks.push({
    //         url: m(url),
    //         filename: `${versionPath}/${id}`,
    //         extra: { size },
    //     });
    // }
    // sort task by size (descending)
    tasks.sort((a, b) => b.extra.size - a.extra.size);
    console.log(chalk.green(t("start_download")));
    let dl = new DownloadQueue(16, { totalSize });
    for (const task of tasks) {
        dl.addTask(task);
    }
    await dl.wait();
    console.log(chalk.green(t("download_completed")));
    console.log(chalk.cyan(t("creating_neccessary_files")));
    // launcher profiles
    if (!fs.existsSync(`${basepath}/launcher_profiles.json`)) {
        fs.writeFileSync(
            `${basepath}/launcher_profiles.json`,
            JSON.stringify(McLauncherProfiles),
        );
    }
    console.log(chalk.green(t("done")));
}

export async function listGames(basepath: string) {
    const gamesDir = `${basepath}/versions`;
    const games: string[] = [];
    if (fs.existsSync(gamesDir)) {
        for (const game of fs.readdirSync(gamesDir)) {
            if (fs.existsSync(`${gamesDir}/${game}/${game}.json`)) {
                games.push(game);
            }
        }
    }
    return games;
}

function cpSep(){
    if(getOs()=="windows")return ";";
    return ":";
}

export async function launchGame(basepath: string, game: string) {
    // login
    const users=getUsers();
    if(users.length===0){
        console.log(chalk.red(t("launch_precheck_no_users")));
        return;
    }
    const user=await select({
        message: t("launcher_user_select_desc"),
        choices: users.map((p)=>({
            value: p,
            name: `${p.name} (${t("user_type."+p.type)})`,
            description: t("launch_user_select_user_desc",p.uuid,t("user_type."+p.type)),
            short: `${p.name} (${t("user_type."+p.type)})`,
        })),
    });
    // extract natives
    // a much more easy way: check file names
    console.log(chalk.blue(t("launch_extracting_natives")));
    const os = getOs();
    const suffix = getArchSuffix();
    const verJson = JSON.parse(
        fs.readFileSync(`${basepath}/versions/${game}/${game}.json`, {
            encoding: "utf-8",
        }),
    );
    const extractLibs: string[] = [];
    const libraries: string[] = [];
    const extractDir = `${basepath}/versions/${game}/natives-${os}${suffix}`;
    for (const lib of verJson.libraries) {
        // no suffix
        if (lib.downloads.artifact) {
            if (lib.downloads.artifact.path.includes(`natives-${os}`)) {
                extractLibs.push(lib.downloads.artifact.path);
            }
            // check rules
            if (
                lib.rules && checkRules(lib.rules, {
                    os: { name: getOs(), arch: arch(), version: release() },
                })
            ) {
                libraries.push(
                    `${basepath}/libraries/${lib.downloads.artifact.path}`,
                );
            } else if (!lib.rules) {
                libraries.push(
                    `${basepath}/libraries/${lib.downloads.artifact.path}`,
                );
            }
        }
        if (lib.downloads.classifiers) {
            if (lib.downloads.classifiers[`natives-${os}`]) {
                extractLibs.push(
                    lib.downloads.classifiers[`natives-${os}`].path,
                );
            }
        }
        // has suffix
        if (suffix != "") {
            if (lib.downloads.artifact) {
                if (
                    lib.downloads.artifact.path.includes(
                        `natives-${os}${suffix}`,
                    )
                ) {
                    extractLibs.push(lib.downloads.artifact.path);
                }
            }
            if (lib.downloads.classifiers) {
                if (lib.downloads.classifiers[`natives-${os}${suffix}`]) {
                    extractLibs.push(
                        lib.downloads.classifiers[`natives-${os}${suffix}`]
                            .path,
                    );
                }
            }
        }
    }
    libraries.push(`${basepath}/versions/${game}/${game}.jar`);
    fs.mkdirSync(`${extractDir}/tmp`, { recursive: true });
    for (const lib of extractLibs) {
        // console.log(chalk.blue(`extracting ${lib}...`));
        // await zl.extract(`${basepath}/libraries/${lib}`, `${extractDir}/tmp`);
        const zip=new AdmZip(`${basepath}/libraries/${lib}`);
        zip.extractAllTo(`${extractDir}/tmp`, true);
    }
    // fs recursively get all the files in /tmp folder
    // and move them to the natives folder
    console.log(chalk.blue(t("launch_moving_files")));
    fs.readdirSync(`${extractDir}/tmp`, {
        withFileTypes: true,
        recursive: true,
    }).forEach(
        (file) => {
            if (
                file.isFile() && !file.name.endsWith(".git") &&
                !file.name.endsWith(".sha1") && !file.name.endsWith(".class")
            ) {
                fs.copyFileSync(
                    nodePath.join(
                        file.parentPath,
                        file.name,
                    ),
                    nodePath.join(
                        extractDir,
                        file.name,
                    ),
                );
            }
        },
    );
    // delete tmp
    fs.rmSync(`${extractDir}/tmp`, { recursive: true });
    console.log(chalk.green(t("launch_extracting_natives_done")));
    // parse start up arguments
    const cmd = [];
    // parse arguments above
    const argparams = {
        "version_name": verJson.id,
        "version_type": "QMCLI v"+packageJson.version,
        "game_directory": basepath,
        "assets_root": `${basepath}/assets`,
        "assets_index_name": verJson.assets,
        "natives_directory": extractDir,
        "launcher_name": "QMCLI",
        "launcher_version": "0.0.1",
        "classpath": `${libraries.join(cpSep())}`,
        "resolution_width": "854",
        "resolution_height": "480",

        // user stuff
        "auth_player_name":user.name,
        "auth_uuid":user.uuid,
        "auth_access_token":user.auth_access_token,
        "user_properties": "{}",
        "user_type": "msa"
    };
    cmd.push(
        "-XX:+UnlockExperimentalVMOptions",
        "-XX:+UseG1GC",
        "-XX:G1NewSizePercent=20",
        "-XX:G1ReservePercent=20",
        "-XX:MaxGCPauseMillis=50",
        "-XX:G1HeapRegionSize=32m",
        "-XX:-UseAdaptiveSizePolicy",
        "-XX:-OmitStackTraceInFastThrow",
        "-XX:-DontCompileHugeMethods",
        "-Dfml.ignoreInvalidMinecraftCertificates=true",
        "-Dlog4j2.formatMsgNoLookups=true",
    );
    fs.writeFileSync(
        `${basepath}/versions/${game}/log4j2-qmcli.xml`,
        McLog4j2Xml,
        { encoding: "utf-8" },
    );
    cmd.push(
        verJson.logging.client.argument.replace(
            "${path}",
            `${basepath}/versions/${game}/log4j2-qmcli.xml`,
        ),
    );
    cmd.push(`-Dminecraft.client.jar=${basepath}/versions/${game}/${game}.jar`);
    const parseJvmArgs = (args: any) => {
        for (const param of args) {
            if (typeof param === "string") {
                let tmp = param;
                for (const [key, value] of Object.entries(argparams)) {
                    tmp = tmp.replace(`$\{${key}\}`, value);
                }
                cmd.push(tmp);
            } else {
                // parse rules
                if (
                    checkRules(param.rules, {
                        os: { name: getOs(), arch: arch(), version: release() },
                    })
                ) {
                    let tmp = Array.isArray(param.value)
                        ? param.value.map((p: string) => `${p}`).join(" ")
                        : `${param.value}`;
                    for (const [key, value] of Object.entries(argparams)) {
                        tmp = tmp.replace(`$\{${key}\}`, value);
                    }
                    cmd.push(tmp);
                }
            }
        }
    };
    if (verJson.arguments) {
        // 1.13+
        // jvm
        parseJvmArgs(verJson.arguments.jvm);
        cmd.push(verJson.mainClass);
        for (const param of verJson.arguments.game) {
            if (typeof param === "string") {
                let tmp = param;
                for (const [key, value] of Object.entries(argparams)) {
                    tmp = tmp.replace(`$\{${key}\}`, value);
                }
                cmd.push(tmp);
            } else {
                if (
                    checkRules(param.rules, {
                        os: { name: getOs(), arch: arch(), version: release() },
                        has_custom_resolution: true,
                    })
                ) {
                    let tmp = Array.isArray(param.value)
                        ? param.value.map((p: string) => `${p}`).join("|$|")
                        : `${param.value}`;
                    for (const [key, value] of Object.entries(argparams)) {
                        tmp = tmp.replace(`$\{${key}\}`, value);
                    }
                    cmd.push(...tmp.split("|$|"));
                }
            }
        }
    } else if (verJson.minecraftArguments) {
        // now we need to modify jvm stuff on our own
        parseJvmArgs([
            {
                "rules": [
                    {
                        "action": "allow",
                        "os": {
                            "name": "osx",
                        },
                    },
                ],
                "value": [
                    "-XstartOnFirstThread",
                ],
            },
            {
                "rules": [
                    {
                        "action": "allow",
                        "os": {
                            "name": "windows",
                        },
                    },
                ],
                "value":
                    "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
            },
            {
                "rules": [
                    {
                        "action": "allow",
                        "os": {
                            "arch": "x86",
                        },
                    },
                ],
                "value": "-Xss1M",
            },
            "-Djava.library.path=${natives_directory}",
            "-Djna.tmpdir=${natives_directory}",
            "-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}",
            "-Dio.netty.native.workdir=${natives_directory}",
            "-Dminecraft.launcher.brand=${launcher_name}",
            "-Dminecraft.launcher.version=${launcher_version}",
            "-cp",
            "${classpath}",
        ]);
        cmd.push(verJson.mainClass);
        let args = verJson.minecraftArguments.split(" ");
        for (const param of args) {
            if (param.startsWith("${")) {
                let tmp = param;
                for (const [key, value] of Object.entries(argparams)) {
                    tmp = tmp.replace(`$\{${key}\}`, value);
                }
                cmd.push(tmp);
            } else {
                cmd.push(param);
            }
        }
        // extras
        cmd.push(...["--width",argparams.resolution_width,"--height",argparams.resolution_height]);
    }
    if(user.type==="offline"){}

    let command = "java " + cmd.map((p) => {
        if (p.includes(" ")) {
            return `"${p}"`;
        } else return p;
    }).join(" ");
    // console.log(command)
    console.log(chalk.green(t("launch_starting")));
    spawn("java", cmd, {
        stdio: "inherit",
        shell: false,
        cwd: basepath,
    });
}

export function deleteGame(basepath: string,game:string){
    fs.rmSync(nodePath.join(basepath,"versions",game),{recursive:true});
}