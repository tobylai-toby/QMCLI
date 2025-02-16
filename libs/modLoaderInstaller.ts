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
import { select, Separator } from "@inquirer/prompts";
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
    static async getInstallersFromMcVersion(
        mcVersion: string,
    ): Promise<InstallerEntry[] | null> {
        const apiSupportedMcVersions = m(
            "https://meta.fabricmc.net/v2/versions/game",
        );
        const supportedMcVersions =
            (await (await fetch(apiSupportedMcVersions)).json() as {
                version: string;
                stable: boolean;
            }[]).map((v) => v.version);
        if (!supportedMcVersions.includes(mcVersion)) {
            return null;
        }
        const apiLoaderVersions = m(
            `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`,
        );
        const loaderVersions =
            (await (await fetch(apiLoaderVersions)).json()) as {
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
            `https://meta.fabricmc.net/v2/versions/loader/${entry.mcversion}/${entry.version}/profile/json`,
        );
        const profileJson = await (await fetch(apiProfile)).json();
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
                        "path":
                            path,
                        "sha1": profileJson.libraries[i].sha1,
                        "size": profileJson.libraries[i].size,
                        "url": m(profileJson.libraries[i].url+path)
                    },
                },
                "name": profileJson.libraries[i].name,
            };
            // check if the original has the same library
            let lib=profileJson.libraries[i].name.split(":").slice(0,2).join(":");
            let foundIndex=originalVerJson.libraries.findIndex((l:any)=>l.name.split(":").slice(0,2).join(":")==lib);
            if(foundIndex!==-1){
                console.log("removed duplicated library: "+originalVerJson.libraries[foundIndex].name)
                originalVerJson.libraries.splice(foundIndex,1);
            }
        }
        delete profileJson.id;
        const merged = deepmerge(originalVerJson, profileJson);
        
        fs.copyFileSync(
            `${basepath}/versions/${game}/${game}.json`,
            `${basepath}/versions/${game}/${game}-original.json`,
        );
        fs.writeFileSync(
            `${basepath}/versions/${game}/${game}.json`,
            JSON.stringify(merged, null, 4),
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
type LoaderTypes="fabric"|"forge"|"quilt"|"neoforged";
// (async () => {
//     const ver =
//         (await FabricInstaller.getInstallersFromMcVersion("1.21.4"))![0];
//     await FabricInstaller.install(ver, "C:\\Users\\Toby\\.minecraft", "1.21.4");
// })();

const installers:Record<LoaderTypes,typeof BaseInstaller>={
    fabric:FabricInstaller,
    forge:BaseInstaller,// TODO
    quilt:BaseInstaller,// TODO
    neoforged:BaseInstaller,// TODO
}

export function detectModLoader(verJson:any):LoaderTypes|"unknown"|false{
    if(verJson.inheritsFrom){
        if(verJson.mainClass.includes("fabricmc")){
            return "fabric";
        }else if(verJson.mainClass.includes("quiltmc")){
            return "quilt";
        }else if(verJson.arguments.game.includes("forgeclient")){
            return "forge";
        }else if(verJson.arguments.game.includes("neoforgeclient")){
            return "neoforged";
        }
        return "unknown";
    }else{
        return false;
    }
}

export async function autoInstallPrompt(basepath:string,game:string,mcversion:string) {
    const gamePath=nodePath.join(basepath,"versions",game);
    const verJson=JSON.parse(fs.readFileSync(nodePath.join(gamePath,game+".json"),{encoding:"utf-8"})) as any;
    const detected=detectModLoader(verJson);
    if(detected){
        console.log(chalk.red(t("auto_install_prompt_already_installed_mod_loader",detected)));
        return;
    }
    const loader=await select<LoaderTypes>({
        message: t("auto_install_prompt_select_mod_loader"),
        choices: [
            {name:"Fabric",value:"fabric"},
            new Separator(),
            {name:"Forge ❌todo",value:"forge"},
            {name:"Quilt ❌todo",value:"quilt"},
            {name:"NeoForge ❌todo",value:"neoforged"},
        ]
    });
    const installer=installers[loader];
    const loader_versions=await installer.getInstallersFromMcVersion(mcversion);
    if(!loader_versions){
        console.log(chalk.red(t("auto_install_prompt_no_loaders_found")));
        return;
    }
    const loader_version=await select({
        message: t("auto_install_prompt_select_loader_version"),
        choices: loader_versions.map((v)=>({name:v.version,value:v}))
    });
    console.log(chalk.green(t("operation_starting")))
    await installer.install(loader_version,basepath,game);
    console.log(chalk.green(t("operation_completed")))
}