const path = require('path');
const fs = require('fs');
const os = require('os');

class PathValidator {
    constructor() {
        this.dangerousPaths = this.buildDangerousPathsList();
    }

    buildDangerousPathsList() {
        const dangerous = [];
        
        if (os.platform() === 'win32') {
            dangerous.push(
                'C:\\Windows\\System32',
                'C:\\Windows\\SysWOW64',
                'C:\\Windows\\config',
                'C:\\ProgramData',
                'C:\\$Recycle.Bin'
            );
        } else {
            dangerous.push(
                '/etc/shadow',
                '/etc/passwd',
                '/etc/sudoers',
                '/etc/ssh',
                '/root/.ssh',
                '/sys',
                '/proc',
                '/dev',
                '/boot'
            );
        }
        
        return dangerous;
    }

    sanitizePath(inputPath) {
        if (typeof inputPath !== 'string') {
            return null;
        }

        if (inputPath.length === 0 || inputPath.length > 4096) {
            return null;
        }

        try {
            const normalized = path.normalize(inputPath);
            const resolved = path.resolve(normalized);

            if (normalized.includes('..')) {
                console.warn('Path traversal detected:', inputPath);
                return null;
            }

            if (normalized !== inputPath && !inputPath.startsWith('.')) {
                console.warn('Path normalization changed path significantly:', inputPath);
            }

            for (const dangerous of this.dangerousPaths) {
                if (resolved.toLowerCase().startsWith(dangerous.toLowerCase())) {
                    console.warn('Access to dangerous path blocked:', inputPath);
                    return null;
                }
            }

            return resolved;
        } catch (e) {
            console.error('Path validation error:', e);
            return null;
        }
    }

    isPathSafe(inputPath, allowedBasePaths = []) {
        const sanitized = this.sanitizePath(inputPath);
        if (!sanitized) return false;

        if (allowedBasePaths.length === 0) {
            return true;
        }

        for (const basePath of allowedBasePaths) {
            try {
                const resolvedBase = path.resolve(basePath);
                if (sanitized.startsWith(resolvedBase)) {
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        return false;
    }

    validateAndSanitize(inputPath, allowedBasePaths = []) {
        const sanitized = this.sanitizePath(inputPath);
        if (!sanitized) return null;

        if (!this.isPathSafe(inputPath, allowedBasePaths)) {
            return null;
        }

        return sanitized;
    }

    isReadablePath(inputPath) {
        const sanitized = this.sanitizePath(inputPath);
        if (!sanitized) return false;

        try {
            fs.accessSync(sanitized, fs.constants.R_OK);
            return true;
        } catch (e) {
            return false;
        }
    }

    isWritablePath(inputPath) {
        const sanitized = this.sanitizePath(inputPath);
        if (!sanitized) return false;

        try {
            fs.accessSync(sanitized, fs.constants.W_OK);
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new PathValidator();
