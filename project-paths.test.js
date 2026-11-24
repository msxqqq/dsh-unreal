import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstAvailableProjectName, newProjectPath, validDirectory, validProjectName } from './project-paths.js';

test('creates the exact Unicode default path under the chosen folder', () => {
  assert.equal(firstAvailableProjectName([]), '未命名工程_01');
  assert.equal(firstAvailableProjectName(['未命名工程_01', '未命名工程_02']), '未命名工程_03');
  assert.equal(newProjectPath('D:/Unreal 项目/', '未命名工程_01'), 'D:\\Unreal 项目\\未命名工程_01\\未命名工程_01.uproject');
  assert.equal(newProjectPath('D:\\', '未命名工程_01'), 'D:\\未命名工程_01\\未命名工程_01.uproject');
});

test('rejects unsafe paths, device aliases, and invalid names', () => {
  for (const value of ['D:relative', '\\\\server\\share', '\\\\?\\D:\\Projects', 'D:\\a\\..\\b', 'D:\\a\\LPT1.txt', 'D:\\a.']) {
    assert.equal(validDirectory(value), false, value);
  }
  for (const name of ['1Bad', 'A/B', '工程🚀', 'CON', 'Win64', '工程 名', 'a'.repeat(21)]) {
    assert.equal(validProjectName(name), false, name);
  }
  assert.equal(validDirectory('D:\\Windows\\My Projects'), true);
  assert.equal(validProjectName('未命名工程_01'), true);
});
