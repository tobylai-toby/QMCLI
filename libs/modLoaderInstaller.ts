import { m } from "./mirrors";
import nodePath from "node:path";
import AdmZip from "adm-zip";
import fs from "node:fs";
import { deepmerge } from "deepmerge-ts";
import lzma from "lzma";
import { fetchLibraries } from "./versions";
import { DownloadQueue } from "./downloader";
import { t } from "../translations/translate";
import chalk from "chalk";
import { confirm, select, Separator } from "@inquirer/prompts";
import { checkRules, mergeVerJsonPatches } from "./utils";
// mod loader installers (eg forge,neoforge,fabric,quilt)

export interface InstallerEntry {
    url?: string;
    mcversion: string;
    version: string;
}

export class BaseInstaller {
    static async getInstallersFromMcVersion(
        mcVersion: string,
    ): Promise<InstallerEntry[] | null> {
        return null;
    }
    static async install(
        entry: InstallerEntry,
        basepath: string,
        game: string,
    ) {}
}
/* no forge at the moment, it's soooo haaaard
export class ForgeInstaller extends BaseInstaller {
    static async getInstallersFromMcVersion(
        mcVersion: string,
    ): Promise<InstallerEntry[] | null> {
        const apiMcVersions = m(
            "https://bmclapi2.bangbang93.com/forge/minecraft",
        );
        const mcVersions: string[] = await (await fetch(apiMcVersions)).json();
        if (!mcVersions.includes(mcVersion)) {
            return null;
        }
        const apiInstallerVersions = m(
            `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`,
        );
        const installerVersions: any[] =
            await (await fetch(apiInstallerVersions)).json();
        return installerVersions.map((v) => {
            return {
                url: m(
                    `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${mcVersion}-${v.version}/forge-${mcVersion}-${v.version}-installer.jar`,
                ),
                version: v.version,
            };
        });
    }
    static async install(
        installerPath: string,
        basepath: string,
        game: string,
    ) {
        const gamePath = nodePath.join(basepath, "versions", game);
        const tmpPath = nodePath.join(gamePath, "tmp-forge");
        fs.mkdirSync(tmpPath, { recursive: true });
        const zip = new AdmZip(installerPath);
        zip.extractAllTo(tmpPath, true);

        // verjson
        fs.copyFileSync(
            nodePath.join(gamePath, `${game}.json`),
            nodePath.join(gamePath, `${game}-original.json`),
        );
        const verJson = JSON.parse(
            fs.readFileSync(nodePath.join(gamePath, `${game}.json`), {
                encoding: "utf-8",
            }),
        ) as any;
        const forgeVerJson = JSON.parse(
            fs.readFileSync(nodePath.join(tmpPath, "version.json"), {
                encoding: "utf-8",
            }),
        ) as any;
        delete forgeVerJson.id;
        const merged = deepmerge(verJson, forgeVerJson);
        // fs.writeFileSync(nodePath.join(gamePath,`${game}.json`),JSON.stringify(merged,null,4),{encoding:"utf-8"});
        // fetch libraries in version.json
        const { tasks, totalSize } = await fetchLibraries(
            forgeVerJson,
            basepath,
            game,
        );
        const dl = new DownloadQueue(16, { totalSize });
        for (const task of tasks) {
            dl.addTask(task);
        }
        await dl.wait();
        const forgeInstallProfileJson=JSON.parse(fs.readFileSync(nodePath.join(tmpPath,"install_profile.json"),{encoding:"utf-8"}));
        {
            const { tasks, totalSize } = await fetchLibraries(
                forgeInstallProfileJson,
                basepath,
                game,
            );
            const dl = new DownloadQueue(16, { totalSize });
            for (const task of tasks) {
                dl.addTask(task);
            }
            await dl.wait();
        }

        // client
        // fs.copyFileSync(nodePath.join(gamePath,`${game}.jar`),nodePath.join(gamePath,`${game}-original.jar`));
        // // tmp/data/client.lzma extract->${game}.jar
        // const clientLzma=fs.readFileSync(nodePath.join(tmpPath,"data","client.lzma"));
        // const client=lzma.decompress(clientLzma);
        // fs.writeFileSync(nodePath.join(gamePath,`${game}.jar`),Buffer.from(client));

        fs.rmSync(tmpPath, { recursive: true });
        console.log("installed forge");
    }
}

// (async () => {
//     const { url } =
//         (await ForgeInstaller.getInstallersFromMcVersion("1.17.1"))![0];
//     // console.log(url)
//     // fs.writeFileSync("forge.jar",Buffer.from(await (await fetch(url)).arrayBuffer()));
//     await ForgeInstaller.install(
//         "forge-patched.jar",
//         "C:\\Users\\Toby\\.minecraft",
//         "1.17.1",
//     );
// })();

const ajson=JSON.parse(
    fs.readFileSync("C:\\Users\\Toby\\.minecraft\\versions\\1.17.1\\1.17.1-original.json",{encoding:"utf-8"})
);
const bjson=JSON.parse(
    fs.readFileSync("C:\\Users\\Toby\\.minecraft\\versions\\1.17.1\\1.17.1.json",{encoding:"utf-8"})
);
delete bjson.id;
delete bjson.inheritsFrom;
delete bjson.logging;
const x=(bjson.arguments.jvm as any[]).findIndex((v:any)=>typeof v==="string"&&v.includes("-DignoreList="));
if(x!==-1){
    bjson.arguments.jvm[x]=bjson.arguments.jvm[x]+","+"1.17.1";
}
const merged=deepmerge(ajson,bjson);
fs.writeFileSync("C:\\Users\\Toby\\.minecraft\\versions\\1.17.1\\1.17.1-merged.json",JSON.stringify(merged,null,4),{encoding:"utf-8"});

// download mappings to "MOJMAPS": {
//            "client": "[net.minecraft:client:1.20-20230608.053357:mappings@txt]",
// \libraries\net\minecraft\client\1.20-20230608.053357\client-1.20-20230608.053357-mappings.txt
*/
class FabricInstaller extends BaseInstaller {
    static loader = "fabric";
    static fabricapi = "https://meta.fabricmc.net/v2";
    static headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    };
    static async getInstallersFromMcVersion(
        mcVersion: string,
    ): Promise<InstallerEntry[] | null> {
        const apiSupportedMcVersions = m(
            this.fabricapi + "/versions/game",
        );
        const supportedMcVersions =
            (await (await fetch(apiSupportedMcVersions, {
                headers: this.headers,
            })).json() as {
                version: string;
                stable: boolean;
            }[]).map((v) => v.version);
        if (!supportedMcVersions.includes(mcVersion)) {
            return null;
        }
        const apiLoaderVersions = m(
            `${this.fabricapi}/versions/loader/${mcVersion}`,
        );
        const loaderVersions =
            (await (await fetch(apiLoaderVersions, { headers: this.headers }))
                .json()) as {
                    loader: { version: string; stable: boolean };
                }[];
        return loaderVersions.map((v) => ({
            version: v.loader.version,
            mcversion: mcVersion,
        }));
    }
    static _parseLibNameToPath(name: string) {
        const splitted = name.split(":");
        const path = splitted[0].replaceAll(".", "/") + "/" + splitted[1] +
            "/" + splitted[2] + "/" +
            splitted.slice(1, splitted.length).join("-") + ".jar";
        return path;
    }
    static async install(
        entry: InstallerEntry,
        basepath: string,
        game: string,
    ): Promise<void> {
        const apiProfile = m(
            `${this.fabricapi}/versions/loader/${entry.mcversion}/${entry.version}/profile/json`,
        );
        const profileJson =
            await (await fetch(apiProfile, { headers: this.headers })).json();
        const originalVerJson = JSON.parse(
            fs.readFileSync(`${basepath}/versions/${game}/${game}.json`, {
                encoding: "utf-8",
            }),
        ) as any;
        // parse the json and convert the libraries to normal
        for (let i = 0; i < profileJson.libraries.length; i++) {
            const path = this._parseLibNameToPath(
                profileJson.libraries[i].name,
            );
            profileJson.libraries[i] = {
                "downloads": {
                    "artifact": {
                        "path": path,
                        "sha1": profileJson.libraries[i].sha1,
                        "size": profileJson.libraries[i].size,
                        "url": profileJson.libraries[i].url + path,
                    },
                },
                "name": profileJson.libraries[i].name,
            };
        }
        const merged = deepmerge(originalVerJson, profileJson);
        // patches original verJson
        originalVerJson.patches = originalVerJson.patches || [];
        originalVerJson.patches.push({
            ...profileJson,
            id: this.loader,
            priority: 30000,
            version: entry.version,
        });

        if (
            !fs.existsSync(`${basepath}/versions/${game}/${game}-original.json`)
        ) {
            fs.copyFileSync(
                `${basepath}/versions/${game}/${game}.json`,
                `${basepath}/versions/${game}/${game}-original.json`,
            );
        }
        fs.writeFileSync(
            `${basepath}/versions/${game}/${game}.json`,
            JSON.stringify(originalVerJson, null, 4),
            { encoding: "utf-8" },
        );
        const { tasks, totalSize } = await fetchLibraries(
            merged,
            basepath,
            game,
        );
        if (tasks.length != 0) {
            let dl = new DownloadQueue(16, { totalSize });
            for (const task of tasks) {
                dl.addTask(task);
            }
            await dl.wait();
        }
    }
}
class QuiltInstaller extends FabricInstaller {
    static loader = "quilt";
    static fabricapi = "https://meta.quiltmc.org/v3";
}
type LoaderTypes = "fabric" | "forge" | "quilt" | "neoforged";
const installers: Record<LoaderTypes, typeof BaseInstaller> = {
    fabric: FabricInstaller,
    forge: BaseInstaller, // TODO
    quilt: QuiltInstaller,
    neoforged: BaseInstaller, // TODO
};

export function detectModLoader(verJson: any): LoaderTypes | "unknown" | false {
    verJson = mergeVerJsonPatches(verJson);
    if (verJson.mainClass.includes("fabricmc")) {
        return "fabric";
    } else if (verJson.mainClass.includes("quiltmc")) {
        return "quilt";
    } else if (verJson.arguments.game.includes("forgeclient")) {
        return "forge";
    } else if (verJson.arguments.game.includes("neoforgeclient")) {
        return "neoforged";
    }

    return false;
}

export async function autoInstallPrompt(
    basepath: string,
    game: string,
    mcversion: string,
) {
    const gamePath = nodePath.join(basepath, "versions", game);
    const verJson = JSON.parse(
        fs.readFileSync(nodePath.join(gamePath, game + ".json"), {
            encoding: "utf-8",
        }),
    ) as any;
    const detected = detectModLoader(verJson);
    // if (detected) {
    //     console.log(
    //         chalk.red(
    //             t("auto_install_prompt_already_installed_mod_loader", detected),
    //         ),
    //     );
    //     return;
    // }
    const loader = await select<LoaderTypes>({
        message: t("auto_install_prompt_select_mod_loader"),
        choices: [
            {
                name: `${detected == "fabric" ? "✅ " : ""}Fabric`,
                value: "fabric",
                disabled: detected !== false && detected != "fabric",
            },
            {
                name: `${detected == "quilt" ? "✅ " : ""}Quilt`,
                value: "quilt",
                disabled: detected !== false && detected != "quilt",
            },
            new Separator(),
            {
                name: `${detected == "forge" ? "✅ " : ""}Forge ❌todo`,
                value: "forge",
                disabled: detected !== false && detected != "forge" || true, // TODO
            },
            {
                name: `${detected == "neoforged" ? "✅ " : ""}NeoForge ❌todo`,
                value: "neoforged",
                disabled: detected !== false && detected != "neoforged" || true, // TODO
            },
        ],
    });
    const installer = installers[loader];
    if (!detected) {
        const loader_versions = await installer.getInstallersFromMcVersion(
            mcversion,
        );
        if (!loader_versions) {
            console.log(chalk.red(t("auto_install_prompt_no_loaders_found")));
            return;
        }
        const loader_version = await select({
            message: t("auto_install_prompt_select_loader_version"),
            choices: loader_versions.map((v) => ({
                name: v.version,
                value: v,
            })),
        });
        console.log(chalk.green(t("operation_starting")));
        await installer.install(loader_version, basepath, game);
        console.log(chalk.green(t("operation_completed")));
    } else {
        const action = await select({
            message: t("auto_install_select_action_prompt"),
            choices: [
                {
                    name: t("auto_install_select_action_info"),
                    value: "info",
                    description: t("auto_install_select_action_info_desc"),
                },
                {
                    name: t("auto_install_select_action_delete"),
                    value: "delete",
                    description: t("auto_install_select_action_delete_desc"),
                },
            ],
        });
        if (action == "info") {
            console.log(chalk.green(t("auto_install_info_loader",detected)));
            if (!verJson.patches) {
                console.log(chalk.yellow(t("auto_install_info_err_no_patches")));
            } else {
                const patch = verJson.patches.find((p: any) =>
                    p.id == detected
                );
                if (!patch) {
                    console.log(
                        chalk.yellow(t("auto_install_info_err_no_patches_named",detected)),
                    );
                    return;
                }
                console.log(chalk.green(t("auto_install_version_loader",patch.version)));
            }
        } else if (action == "delete") {
            const confirm_ = await confirm({
                message: t("auto_install_confirm_delete"),
                default: false,
            });
            if (confirm_) {
                // rm patches named
                const patchIndex = verJson.patches.findIndex((p: any) =>
                    p.id == detected
                );
                if (patchIndex == -1) {
                    console.log(
                        chalk.red(t("auto_install_info_err_no_patches_named",detected)),
                    );
                    console.log(chalk.red(t("err_failed")));
                    return;
                }
                verJson.patches.splice(patchIndex, 1);
                fs.writeFileSync(
                    nodePath.join(gamePath, game + ".json"),
                    JSON.stringify(verJson, null, 4),
                );
                console.log(chalk.green(t("operation_completed")));
            }
        }
    }
}
