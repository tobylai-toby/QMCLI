import * as fs from "fs";
import * as path from "path";
import * as cliProgress from "cli-progress";
import chalk from "chalk";

// 定义下载任务接口
export interface DownloadTask {
    url: string;
    filename: string;
    retries?: number; // 重试次数
    extra?: any;
}

// 辅助函数：根据大小动态转换单位
export function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}

export class DownloadQueue {
    private maxParallel: number;
    private queue: DownloadTask[];
    private activeDownloads: Map<string, number>;
    private progressBar: cliProgress.SingleBar;
    private totalTasks: number = 0;
    private completedTasks: number = 0;
    private speedUpdateInterval: NodeJS.Timeout;
    public extra:any;
    private downloadedSize=0;
    private startTime=0;
    // 保持原有构造函数参数
    constructor(maxParallel: number,extra?:any) {
        this.extra=extra;
        this.maxParallel = maxParallel;
        this.queue = [];
        this.activeDownloads = new Map();
        this.startTime = Date.now();
        // 初始化单进度条
        this.progressBar = new cliProgress.SingleBar({
            format(options:cliProgress.Options,params:cliProgress.Params,payload:any) {
                const bar=options.barCompleteChar!.repeat(payload.finishedPercent*20) 
                        + options.barIncompleteChar!.repeat((1-payload.finishedPercent)*20);
                return `${payload.title} | ${bar} | ${(payload.finishedPercent*100).toFixed(1)}% | ${payload.completed}/${payload.totalTasks} | ${payload.speed}`
                        +(extra?.totalSize?` | tot:${formatSize(extra?.totalSize)} | eta:${payload.calcEta.toFixed(1)}s`:'')
            },
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            // clearOnComplete: true
        });

        // 速度更新定时器（保留原有API结构）
        this.speedUpdateInterval = setInterval(() => this.updateProgress(), 100);
    }

    // 保持原有 addTask API
    public addTask(task: DownloadTask): void {
        this.queue.push(task);
        this.totalTasks++;
        if (!this.progressBar.isActive) {
            this.progressBar.start(this.totalTasks, 0, {
                title: 'Waiting...',
                speed: '0.00 B/s',
                completed: 0,
                totalTasks:this.totalTasks,
                finishedPercent: 0,
                calcEta: Infinity
            });
        }
        this.processQueue();
    }

    // 保持原有 processQueue 逻辑
    private processQueue(): void {
        while (this.activeDownloads.size < this.maxParallel && this.queue.length > 0) {
            const task = this.queue.shift()!;
            this.activeDownloads.set(task.filename, 0);
            this.downloadFile(task);
        }
    }

    // 格式化速度显示
    private formatSpeed(bytesPerSecond: number): string {
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let speed = bytesPerSecond;
        let unitIndex = 0;
        while (speed >= 1024 && unitIndex < units.length - 1) {
            speed /= 1024;
            unitIndex++;
        }
        return `${speed.toFixed(2)} ${units[unitIndex]}`;
    }

    // 更新进度显示（保持私有方法）
    private updateProgress(finished:boolean=false): void {
        const currentFiles = Array.from(this.activeDownloads.keys());
        const totalSpeed = this.downloadedSize/((Date.now()-this.startTime)/1000);
        this.progressBar.update(this.completedTasks, {
            title: finished?(chalk.green("Done")):(currentFiles.length > 0 ? 
                `Downloading: (${currentFiles.length} active)` : 
                'Preparing...'),
            speed: this.formatSpeed(totalSpeed),
            completed: this.completedTasks,
            totalTasks:this.totalTasks,
            finishedPercent: this.extra?.totalSize?(this.downloadedSize/this.extra.totalSize):(this.completedTasks / this.totalTasks),
            calcEta: this.extra?.totalSize?(this.extra.totalSize-this.downloadedSize)/totalSpeed:0
        });
    }

    // 保持原有 downloadFile 核心逻辑
    private async downloadFile(task: DownloadTask): Promise<void> {
        try {
            const response = await fetch(task.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const writer = fs.createWriteStream(task.filename);
            writer.on("error",(err)=>{throw err});
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No readable stream');

            let downloaded = 0;
            const startTime = Date.now();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                writer.write(value);
                downloaded += value.length;
                this.downloadedSize+=value.length;
                
                // 更新实时速度
                const elapsed = (Date.now() - startTime) / 1000+0.01;
                this.activeDownloads.set(task.filename, elapsed > 0 ? downloaded / elapsed : 0);
            }

            writer.end();
            this.completedTasks++;
        } catch (error) {
            if ((task.retries || 20) > 0) {
                console.error(`♻️❌ ${task.filename}(retrying): ${(error as Error).message}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                this.queue.push({...task, retries: task.retries! - 1});
            }else{
                console.error(`❌⚙️ ${task.filename}(FAILED!): ${(error as Error).message}`);
                throw error;
            }
        } finally {
            this.activeDownloads.delete(task.filename);
            this.processQueue();
        }
    }

    // 保持原有 wait API
    public async wait(): Promise<void> {
        this.startTime = Date.now();
        while (this.activeDownloads.size > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.updateProgress(true);
        clearInterval(this.speedUpdateInterval);
        this.progressBar.stop();
    }
}



// 示例使用
async function main() {
    const downloadQueue = new DownloadQueue(5); // 限制并行数为 5

    const tasks: DownloadTask[] = [
        {
            url: "https://piston-data.mojang.com/v1/objects/5bc08371cd4da86bcd5afd12bea91c890a3c63bb/client.jar",
            filename: "client.jar",
        },
        {
            url: "https://piston-data.mojang.com/v1/objects/5bc08371cd4da86bcd5afd12bea91c890a3c63bb/client.jar",
            filename: "client1.jar",
        },
        {
            url: "https://piston-data.mojang.com/v1/objects/5bc08371cd4da86bcd5afd12bea91c890a3c63bb/client.jar",
            filename: "client2.jar",
        },
        {
            url: "https://piston-data.mojang.com/v1/objects/5bc08371cd4da86bcd5afd12bea91c890a3c63bb/client.jar",
            filename: "client3.jar",
        },{
            url: "https://piston-data.mojang.com/v1/objects/5bc08371cd4da86bcd5afd12bea91c890a3c63bb/client.jar",
            filename: "client4.jar",
        },
        {
            url: "https://piston-meta.mojang.com/v1/packages/d6d68dd7dbd932e01d730fbc34d7f81b8ea3f813/22.json",
            filename: "22.json",
        },
    ];

    tasks.forEach((task) => downloadQueue.addTask(task)); // 添加任务到队列
    await downloadQueue.wait(); // 等待所有任务完成
    console.log("All downloads completed!");
}

// main().catch(console.error);
