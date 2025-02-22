import * as os from "node:os";
import * as path from "node:path";
import arch from "arch";
import { deepmerge } from "deepmerge-ts";
export function isValidFileName(filename: string): boolean {
    // 基础检查
    if (!filename || filename.length === 0 || filename.length > 255) {
        return false;
    }

    // 特殊名称检查（当前目录和上级目录）
    if (filename === "." || filename === "..") return false;

    // 同时检查正斜杠和反斜杠
    if (filename.includes("/") || filename.includes("\\")) return false;

    // 创建综合正则表达式（同时兼容Windows和Linux的非法字符）
    const illegalChars = /[<>:"|?*\u0000-\u001F]/gu;
    if (illegalChars.test(filename)) return false;

    // 检查连续两个点的路径遍历特征
    if (/\.\./gu.test(filename)) return false;

    // Windows不允许以空格或点结尾（Linux允许）
    if (/[\s.]$/u.test(filename)) return false;

    // 检查Unicode控制字符（C0和C1控制字符）
    const unicodeControlChars = /[\p{C}]/gu;
    if (unicodeControlChars.test(filename)) return false;

    // 最终有效性检查（确保至少有一个非空字符）
    return /^[^\s.]/u.test(filename) && filename.trim() === filename;
}

export function expandTilde(filePath: string) {
    if (filePath.startsWith("~/")) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
}

// check os
// return windows,linux,osx
export function getOs(): string {
    if (os.platform() === "win32") {
        return "windows";
    } else if (os.platform() === "darwin") {
        return "osx";
    } else {
        return "linux";
    }
}
// arch suffix
// x86_64-> nothing
// arm64 -> -arm64
// x86 -> x86
export function getArchSuffix(): string {
    const res = arch();
    if (res === "x64") {
        return "";
    } else { // x86 / arm64
        return "-" + res;
    }
}

export function checkRules(rules: any[], features: any = {}): boolean {
    for (const rule of rules) {
        let isRuleMatched = true;

        // 检查OS条件
        if (rule.os) {
            const osRule = rule.os;
            const currentOS = features.os || {};

            // 检查操作系统名称
            if (osRule.name && currentOS.name !== osRule.name) {
                isRuleMatched = false;
            }

            // 检查操作系统版本（正则匹配）
            if (osRule.version) {
                const versionRegex = new RegExp(osRule.version);
                if (!versionRegex.test(currentOS.version || "")) {
                    isRuleMatched = false;
                }
            }

            // 检查系统架构
            if (osRule.arch && currentOS.arch !== osRule.arch) {
                isRuleMatched = false;
            }
        }

        // 检查特性条件
        if (rule.features) {
            const featureConditions = rule.features;
            for (const [key, value] of Object.entries(featureConditions)) {
                if (features[key] !== value) {
                    isRuleMatched = false;
                    break;
                }
            }
        }

        // 如果当前规则匹配，根据action返回结果
        if (isRuleMatched) {
            return rule.action === "allow";
        }
    }

    // 没有规则匹配时默认返回false
    return false;
}

// export function mergeVerJsonPatches(verJson: any, rm_dup_libs = false) {
//     if (!verJson.patches) return verJson;
//     let newVerJson = JSON.parse(JSON.stringify(verJson));
//     delete newVerJson.patches;
//     (verJson.patches as any[]).sort((a: any, b: any) => a.priority - b.priority)
//         .forEach((x: any) => {
//             let y = JSON.parse(JSON.stringify(x));
//             if(y.id=="game")return;
//             delete y.id;
//             delete y.version;
//             delete y.priority;
//             if (rm_dup_libs) {
//                 for (let i in y.libraries) {
//                     let lib = y.libraries[i].name.split(":").slice(0, 2).join(
//                         ":",
//                     );
//                     let foundIndex = newVerJson.libraries.findIndex((l: any) =>
//                         l.name.split(":").slice(0, 2).join(":") == lib
//                     );
//                     if (foundIndex !== -1) {
//                         console.log(
//                             "disabled duplicated library: " +
//                                 newVerJson.libraries[foundIndex].name,
//                         );
//                         newVerJson.libraries.splice(foundIndex, 1);
//                     }
//                 }
//             }
//             newVerJson = deepmerge(newVerJson, y);
//         });
//     return newVerJson;
// }

export function rmDupLibs(libraries: any[]) {
    let libs: any[] = [];
    let lib_names: string[] = [];
    libraries.forEach((x: any) => {
        let libname = x.name.split(":").slice(0, 2).join(":");
        if (x.name.includes("natives")) {
            libs.push(x);
        } else if (!lib_names.includes(libname)) {
            libs.push(x);
            lib_names.push(libname);
        } else {
            console.log("disabled duplicated library: " + x.name);
        }
    });
    return libs;
}

export function parseLibNameToPath(name: string) {
    const splitted = name.split(":");
    const path = splitted[0].replaceAll(".", "/") + "/" + splitted[1] +
        "/" + splitted[2] + "/" +
        splitted.slice(1, splitted.length).join("-") + ".jar";
    return path;
}
