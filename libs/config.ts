import packageJson from '../package.json';
import Configstore from 'configstore';
export const config = new Configstore(packageJson.name, {
    users: [],
    mirror: "official", // official, bmclapi
    paths: ["~/.minecraft"],
    lang: "en"
});