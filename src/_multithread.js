const cluster = require("cluster");

if (cluster.isMaster) {
    const electron = require("electron");
    const ipc = electron.ipcMain;
    const signale = require("signale");
    // Also, leave a core available for the renderer process
    const osCPUs = require("os").cpus().length - 1;
    // See #904
    const numCPUs = (osCPUs > 7) ? 7 : osCPUs;

    const si = require("systeminformation");

    cluster.setupMaster({
        exec: require("path").join(__dirname, "_multithread.js")
    });

    let workers = [];
    cluster.on("fork", worker => {
        workers.push(worker.id);
    });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    signale.success("Multithreaded controller ready");

    var lastID = 0;

    function dispatch(type, id, arg) {
        let selectedID = lastID+1;
        if (selectedID > numCPUs-1) selectedID = 0;

        cluster.workers[workers[selectedID]].send(JSON.stringify({
            id,
            type,
            arg
        }));

        lastID = selectedID;
    }

    var queue = {};
    const allowedSiMethods = [
        'time', 'cpuCurrentSpeed', 'cpuTemperature', 'currentLoad', 'mem', 
        'battery', 'graphics', 'networkInterfaces', 'networkStats', 
        'fsSize', 'blockDevices', 'processes', 'versions', 'system',
        'osInfo', 'networkConnections'
    ];
    
    ipc.on("systeminformation-call", (e, type, id, ...args) => {
        if (typeof type !== 'string' || !allowedSiMethods.includes(type) || !si[type]) {
            signale.warn("Illegal request for systeminformation:", type);
            return;
        }

        if (typeof id !== 'string' || id.length > 50) {
            signale.warn("Invalid systeminformation ID");
            return;
        }

        if (Object.keys(queue).length > 100) {
            signale.warn("Queue limit reached, dropping request");
            return;
        }

        if (args.length > 1 || workers.length <= 0) {
            si[type](...args).then(res => {
                if (e.sender && !e.sender.isDestroyed()) {
                    e.sender.send("systeminformation-reply-"+id, res);
                }
            }).catch(err => {
                signale.error("systeminformation error:", err);
            });
        } else {
            queue[id] = e.sender;
            dispatch(type, id, args[0]);
        }
    });

    cluster.on("message", (worker, msg) => {
        try {
            msg = JSON.parse(msg);
            if (msg && msg.id && queue[msg.id] && !queue[msg.id].isDestroyed()) {
                queue[msg.id].send("systeminformation-reply-"+msg.id, msg.res);
                delete queue[msg.id];
            } else {
                delete queue[msg.id];
            }
        } catch(e) {
            signale.error("Error parsing cluster message:", e);
        }
    });
} else if (cluster.isWorker) {
    const signale = require("signale");
    const si = require("systeminformation");

    signale.info("Multithread worker started at "+process.pid);

    process.on("message", msg => {
        try {
            msg = JSON.parse(msg);
            if (msg && msg.type && msg.id && typeof si[msg.type] === 'function') {
                si[msg.type](msg.arg).then(res => {
                    process.send(JSON.stringify({
                        id: msg.id,
                        res
                    }));
                }).catch(err => {
                    signale.error("Worker error:", err);
                });
            }
        } catch(e) {
            signale.error("Worker message parse error:", e);
        }
    });
}
