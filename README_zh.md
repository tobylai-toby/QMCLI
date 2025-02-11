# QMCLI
一个快速的Minecraft启动器命令行工具（正在开发中）

## 安装
```bash
$ npm install -g @tobylai/qmcli
$ # 检查安装
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
## 特性
许多特性仍在开发中

- 版本
    - [X] 下载minecraft版本
    - [X] 启动minecraft
    - [ ] 编辑minecraft启动设置
        - [ ] java路径
- 用户
    - [X] 添加/移除用户
    - [X] 离线用户
    - [ ] mojang用户
    - [ ] microsoft用户
- 设置
    - [X] 更改下载镜像
        - [X] 官方
        - [X] bmclapi
    - [X] 管理minecraft安装路径
    - [ ] 更改java路径
- 本地化
    - [X] 支持en (English)
    - [ ] 支持zh_cn (简体中文)

## 常见问题
### 为什么叫这个名字？
QMCLI代表**Q**uick **M**ine**C**raft **L**auncher **CL****I**