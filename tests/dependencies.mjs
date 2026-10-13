import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

// Runtime plugin stays dependency-free; this is development-only discovery.
export const hermesHome=process.env.HERMES_HOME || (process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'hermes'):path.join(os.homedir(),'.hermes'));
export const hermesSource=process.env.HERMES_SOURCE || path.join(hermesHome,'hermes-agent');
export const dependencyRoot=process.env.HERMES_NODE_MODULES ? path.resolve(process.env.HERMES_NODE_MODULES,'..') : process.env.HERMES_SOURCE || path.resolve(import.meta.dirname,'..');
if(!fs.existsSync(path.join(dependencyRoot,'package.json')))throw Error('Set HERMES_SOURCE to the Hermes checkout containing React development dependencies, or HERMES_NODE_MODULES to its node_modules directory.');
export const requireHermes=createRequire(path.join(dependencyRoot,'package.json'));
