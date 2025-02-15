import { config } from "./config";

interface MirrorData{
    launcher:string,
    launchermeta:string,
    pistonmeta:string,
    resources:string,
    libraries:string
}
export const mirrors:Record<string,MirrorData>={
    "official":{
        launcher:"https://launcher.mojang.com",
        launchermeta: "https://launchermeta.mojang.com", 
        pistonmeta: "https://piston-meta.mojang.com",
        resources:"http://resources.download.minecraft.net",
        libraries:"https://libraries.minecraft.net",
    },
    "bmclapi":{
        launcher: "https://bmclapi2.bangbang93.com",
        launchermeta: "https://bmclapi2.bangbang93.com",
        pistonmeta: "https://bmclapi2.bangbang93.com",
        resources: "http://bmclapi2.bangbang93.com/assets",
        libraries: "https://bmclapi2.bangbang93.com/maven"
    }
}
export type MirrorUrlType=keyof MirrorData;
export function toMirror(url: string,mirror:string,type:MirrorUrlType):string{
    return url.replace(mirrors["official"][type], mirrors[mirror][type]);
}
export function m(url:string):string{
    for(const type of Object.keys(mirrors["official"]) as MirrorUrlType[]){
        if(url.startsWith(mirrors["official"][type])){
            return toMirror(url,config.get("mirror"),type);
        }
    }
    return url;
}