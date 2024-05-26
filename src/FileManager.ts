import * as ExpoFS from 'expo-file-system';
import { DownloadOptions } from './types';

export interface FileInfo {
  exists: boolean;
  uri: string;
  size: number;
  modificationTime: number;
  isDirectory: boolean;
  md5: string;
}
export class FileSystem {
  static async fetch(
    url: string,
    options: {
      path: string;
    } & DownloadOptions
  ) {
    return ExpoFS.downloadAsync(url, options.path, options);
  }

  static async readFile(path: string, encoding: string) {
    return ExpoFS.readAsStringAsync(path, encoding);
  }

  static async exists(path: string) {
    return ExpoFS.getInfoAsync(path).then(info => info.exists);
  }

  static async ls(path: string) {
    return ExpoFS.readDirectoryAsync(path);
  }

  static async stat(path: string) {
    return ExpoFS.getInfoAsync(path) as Promise<FileInfo>;
  }

  static async statDir(path: string) {
    const files = await ExpoFS.readDirectoryAsync(path).then(filePaths =>
      filePaths.map(
        (file: string) =>
          ExpoFS.getInfoAsync(`${path}/${file}`) as Promise<FileInfo>
      )
    );
    return Promise.all(files);
  }

  static async unlink(path: string) {
    return ExpoFS.deleteAsync(path);
  }

  static async mkdir(path: string) {
    return ExpoFS.makeDirectoryAsync(path);
  }
}

export class Dirs {
  static CacheDir = ExpoFS.cacheDirectory;
}
