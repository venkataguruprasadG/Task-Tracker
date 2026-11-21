export interface ElectronBridgeAPI {
  isElectron: boolean;
  setMiniMode: (enabled: boolean) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}

export {};
