# QMCLI
English | [简体中文](README_zh_cn.md)

A Quick Minecraft Launcher CLI (Work In Progress)

## Installation
```bash
$ npm install -g @tobylai/qmcli
$ # check the installation
$ qmcli
```

## Usage
```bash
$ qmcli --help
Usage: qmcli [options] [command]

A Quick Minecraft CLI Launcher

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  versions        manage minecraft versions
  settings        manage settings
  users           add/manage users
  help [command]  display help for command
```
## Features
many features are still working in progress

- versions
    - [X] download minecraft versions
    - [X] launch minecraft
    - [ ] edit minecraft launch settings
        - [ ] java path
- users
    - [X] add/remove users
    - [X] offline users
    - [ ] mojang users (deprecated?)
    - [ ] microsoft users
- settings
    - [X] change download mirror
        - [X] official
        - [X] bmclapi
    - [X] manage minecraft installation paths
    - [ ] change java path
- localization
    - [X] support en(English)
    - [X] support zh_cn(简体中文)

## FAQ
### Why the name?
QMCLI is for **Q**uick **M**ine**C**raft **L**auncher **CLI**