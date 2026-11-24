import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// A link-installed bundle does not get its own copies of the Host's packages.
const installDir = process.env.DSH_INSTALL_DIR || (process.resourcesPath &&
  join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh'));
if (!installDir) throw new Error('Cannot locate the DeepSeek Harness installation.');
const resolve = createRequire(join(installDir, 'package.json'));
export const fromHost = name => import(pathToFileURL(resolve.resolve(name)).href);
