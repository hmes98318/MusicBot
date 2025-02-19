import os from 'os';
import util from 'util';
import { exec } from 'child_process';

import { CpuInfo } from 'os';

const execPromisify = util.promisify(exec);


const sysusage = {
    cpu: async () => {
        const platform = os.platform();
        const load = os.loadavg();
        const strLoad = `[${load[0].toFixed(2)}, ${load[1].toFixed(2)}, ${load[2].toFixed(2)}]`;
        let cpuPercent = '0%';

        if (platform === 'win32') {
            try {
                const { stdout, stderr } = await execPromisify('wmic cpu get LoadPercentage');
                if (stderr) {
                    throw new Error(stderr);
                }

                const loadArr = stdout.split('\r\r\n').filter((item) => !isNaN(parseInt(item)));
                const totalLoad = loadArr.reduce((acc, load) => acc + parseInt(load), 0);
                const avgLoad = Math.round(totalLoad / loadArr.length);
                cpuPercent = avgLoad + '%';
            } catch (error) {
                console.error('Error getting CPU load:', error);
            }
        }
        else {
            cpuPercent = await getCpuPercentage() + '%';
        }

        return {
            percent: cpuPercent,
            detail: strLoad
        };
    },
    ram: () => {
        const totalRam = os.totalmem();
        const usedRam = process.memoryUsage().rss;
        const usedRatio = ((usedRam / totalRam * 10000) / 100).toFixed(1);
        const totalMb = (totalRam / (1024 * 1024)).toFixed(0);
        const usedMb = (usedRam / (1024 * 1024)).toFixed(0);

        return {
            percent: `${usedRatio}%`,
            detail: `(${usedMb} / ${totalMb} MB)`
        };
    },
    heap: () => {
        const totalHeap = process.memoryUsage().heapTotal;
        const usedHeap = process.memoryUsage().heapUsed;
        const usedRatio = ((usedHeap / totalHeap * 10000) / 100).toFixed(1);
        const totalMb = (totalHeap / (1024 * 1024)).toFixed(0);
        const usedMb = (usedHeap / (1024 * 1024)).toFixed(0);

        return {
            percent: `${usedRatio}%`,
            detail: `(${usedMb} / ${totalMb} MB)`
        };
    }
};

export { sysusage };


const getCpuLoad = () => {
    const cpus = os.cpus();

    let totalIdle = 0,
        totalTick = 0;

    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type as keyof CpuInfo['times']];
        }
        totalIdle += cpu.times.idle;
    });

    return {
        idle: totalIdle / cpus.length,
        total: totalTick / cpus.length
    };
};

const getCpuPercentage = () => {
    const firstLoad = getCpuLoad();

    return new Promise(resolve => {
        setTimeout(() => {
            const secondLoad = getCpuLoad();

            const idleDiff = secondLoad.idle - firstLoad.idle;
            const totalDiff = secondLoad.total - firstLoad.total;
            const avgLoad = 100 - ~~(100 * idleDiff / totalDiff);

            resolve(avgLoad);
        }, 1000);
    });
};