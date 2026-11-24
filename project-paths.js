import { lstat, readdir } from 'node:fs/promises';
import { win32 as path } from 'node:path';

const reservedDevice = /^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/i;
const reservedPlatform = /^(Win64|Windows|Linux|Mac|Android|IOS)$/i;
export function validDirectory(value) {
  return typeof value === 'string' && value.length <= 2048 && /^[a-z]:[\\/]/i.test(value) &&
    !/[\x00-\x1f\x7f<>"|?*:]/.test(value.slice(2)) &&
    value.slice(3).split(/[\\/]/).every(part => !part || (!/[. ]$/.test(part) && !reservedDevice.test(part.split('.')[0].trimEnd())));
}
export function validProjectName(value) {
  return typeof value === 'string' && value.length <= 20 && !/[\uD800-\uDFFF]/.test(value) &&
    /^\p{L}[\p{L}\p{Nd}_]*$/u.test(value) && !reservedDevice.test(value) && !reservedPlatform.test(value);
}
export function newProjectPath(directory, name) {
  if (!validDirectory(directory) || !validProjectName(name)) throw new Error('Invalid Unreal project folder or name.');
  return path.join(directory, name, `${name}.uproject`);
}
export function firstAvailableProjectName(names, prefix = '未命名工程') {
  const used = new Set(names.map(name => name.toLowerCase()));
  for (let i = 1; i <= 9999; i++) {
    const name = `${prefix}_${String(i).padStart(2, '0')}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  throw new Error('No unused default Unreal project name in this folder.');
}
export async function suggestProjectName(directory, prefix) {
  const entry = await lstat(directory);
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Choose an existing local project folder.');
  return firstAvailableProjectName(await readdir(directory), prefix);
}
