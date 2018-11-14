const { spawnSync } = require('child_process');
/**
 * runs a command line function
 * 
 * @param {any} commandString 
 * @param {any} options 
 */
exports.runCommand = function (commandString, options) {
    const [command, ...args] = commandString.match(/(".*?")|(\S+)/g)
    const cmd = spawnSync(command, args, options)
    const errorString = cmd.stderr.toString()
    if (errorString) {
        console.log('throwing error', errorString);
        throw new Error(`Command failed: ${commandString}  error: ${errorString}`);
    }
    return cmd.stdout.toString();
};