declare module "@mkkellogg/gaussian-splats-3d" {
  export class Viewer {
    constructor(options: Record<string, unknown>);
    addSplatScene(url: string): Promise<void>;
    dispose(): void;
  }
}
