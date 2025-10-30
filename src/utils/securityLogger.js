const fs = require('fs');
const path = require('path');

class SecurityLogger {
    constructor(logDir) {
        this.logDir = logDir;
        this.logFile = path.join(logDir, 'security.log');
        this.maxLogSize = 5 * 1024 * 1024; // 5MB
        this.ensureLogDir();
    }

    ensureLogDir() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, {recursive: true});
            }
        } catch (e) {
            console.error('Failed to create security log directory:', e);
        }
    }

    rotateLogIfNeeded() {
        try {
            if (fs.existsSync(this.logFile)) {
                const stats = fs.statSync(this.logFile);
                if (stats.size > this.maxLogSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const backupFile = path.join(this.logDir, `security.log.${timestamp}`);
                    fs.renameSync(this.logFile, backupFile);
                    const logs = fs.readdirSync(this.logDir)
                        .filter(f => f.startsWith('security.log.'))
                        .sort()
                        .reverse();
                    if (logs.length > 5) {
                        logs.slice(5).forEach(f => {
                            try {
                                fs.unlinkSync(path.join(this.logDir, f));
                            } catch (e) {}
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to rotate log:', e);
        }
    }

    log(level, event, details = {}) {
        try {
            this.rotateLogIfNeeded();
            const entry = {
                timestamp: new Date().toISOString(),
                level: level.toUpperCase(),
                event,
                details,
                pid: process.pid
            };
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(this.logFile, line, {encoding: 'utf8'});
        } catch (e) {
            console.error('Failed to write security log:', e);
        }
    }

    info(event, details) {
        this.log('info', event, details);
    }

    warn(event, details) {
        this.log('warn', event, details);
    }

    error(event, details) {
        this.log('error', event, details);
    }

    critical(event, details) {
        this.log('critical', event, details);
    }

    authSuccess(event, details) {
        this.log('auth_success', event, details);
    }

    authFailure(event, details) {
        this.log('auth_failure', event, details);
    }

    accessDenied(event, details) {
        this.log('access_denied', event, details);
    }

    rateLimitExceeded(event, details) {
        this.log('rate_limit', event, details);
    }
}

module.exports = SecurityLogger;
