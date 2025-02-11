import transEn from "./en.json";
import transZhCN from "./zh-CN.json";

// languages
export const languages:Record<string,TransType> = { "en": transEn,"zh-CN": transZhCN };

export type TransType=typeof transEn
export type TransKey=keyof TransType

export let activedTrans:Record<string,string>=transEn;
export function installTrans(trans:Record<string,string>){
    activedTrans=trans;
}

export function t(key:TransKey|string,...args:any[]){
    let val=activedTrans[key]||key;
    // replace $1,$2,$3 into args[0] args[1] args[3] and so on
    for(let i=0;i<args.length;i++){
        val=val.replace(`$${i+1}`,args[i]);
    }
    return val;
}
