"use client";

import { useEffect, useRef, useState } from "react";

function pickSplatUrl(urls: { spz100k?: string; spz500k?: string; spzFull?: string; marbleUrl?: string }) {
  if (typeof window === "undefined") return urls.spz500k ?? urls.marbleUrl;
  const isMobile = window.innerWidth < 768;
  const lowEnd = navigator.hardwareConcurrency <= 4;
  if (isMobile && lowEnd && urls.spz100k) return urls.spz100k;
  if (isMobile && urls.spz500k) return urls.spz500k;
  return urls.spzFull ?? urls.spz500k ?? urls.spz100k ?? urls.marbleUrl;
}

function isSpzAsset(url?: string, format?: string) {
  if (format === "spz") return true;
  return Boolean(url && /\.spz(\?|$)/i.test(url));
}

async function downloadWithProgress(
  url: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onProgress(100);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress(100);
  return out.buffer;
}

export function SplatViewer({
  experienceId,
  spz100kUrl,
  spz500kUrl,
  spzFullResUrl,
  worldMarbleUrl,
  colliderMeshUrl,
  splatFormat,
  onPositionChange,
}: {
  experienceId?: string;
  spz100kUrl?: string;
  spz500kUrl?: string;
  spzFullResUrl?: string;
  worldMarbleUrl?: string;
  colliderMeshUrl?: string;
  viewerUrl?: string;
  splatFormat?: string;
  onPositionChange?: (x: number, y: number, z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPositionRef = useRef(onPositionChange);
  onPositionRef.current = onPositionChange;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"download" | "decode" | "ready">("download");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const selectedUrl = pickSplatUrl({
      spz100k: spz100kUrl,
      spz500k: spz500kUrl,
      spzFull: spzFullResUrl,
      marbleUrl: worldMarbleUrl,
    });

    if (!selectedUrl) {
      setLoadError("No 3D world file available.");
      setLoading(false);
      return;
    }

    const useSpark = isSpzAsset(selectedUrl, splatFormat);
    const abort = new AbortController();
    let disposed = false;
    let animId = 0;
    let cleanup: (() => void) | undefined;

    setLoadError(null);
    setLoading(true);
    setLoadProgress(0);
    setPhase("download");

    async function initSpark(fileBytes: ArrayBuffer) {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");

      if (disposed || !containerRef.current) return;

      const el = containerRef.current;
      el.innerHTML = "";

      setPhase("decode");

      const width = Math.max(el.clientWidth, 320);
      const height = Math.max(el.clientHeight, 240);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
      camera.position.set(0, 1.2, 3);

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);

      const spark = new SparkRenderer({ renderer });
      scene.add(spark);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0, 0);

      const splatMesh = new SplatMesh({
        fileBytes,
        fileName: "world.spz",
      });
      splatMesh.quaternion.set(1, 0, 0, 0);
      scene.add(splatMesh);

      await splatMesh.initialized;

      if (disposed) return;

      setPhase("ready");
      setLoading(false);
      setLoadProgress(100);

      const resize = () => {
        if (!containerRef.current) return;
        const w = Math.max(containerRef.current.clientWidth, 320);
        const h = Math.max(containerRef.current.clientHeight, 240);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      const animate = () => {
        if (disposed) return;
        controls.update();
        onPositionRef.current?.(camera.position.x, camera.position.y, camera.position.z);
        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(animId);
        controls.dispose();
        renderer.dispose();
        el.innerHTML = "";
      };
    }

    async function initLegacy(fileBytes?: ArrayBuffer) {
      if (disposed || !containerRef.current) return;
      const el = containerRef.current;
      el.innerHTML = "";

      if (worldMarbleUrl && selectedUrl === worldMarbleUrl) {
        el.innerHTML = `<iframe src="${worldMarbleUrl}" class="h-full w-full border-0" allow="fullscreen" title="3D world" />`;
        setLoading(false);
        return;
      }

      const { Viewer } = await import("@mkkellogg/gaussian-splats-3d");
      if (disposed || !containerRef.current) return;

      const viewer = new Viewer({
        rootElement: el,
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 1, 3],
        initialCameraLookAt: [0, 0, 0],
        sharedMemoryForWorkers: false,
      });

      if (fileBytes && useSpark === false) {
        const blob = new Blob([fileBytes]);
        const blobUrl = URL.createObjectURL(blob);
        await viewer.addSplatScene(blobUrl);
        URL.revokeObjectURL(blobUrl);
      } else {
        await viewer.addSplatScene(selectedUrl!);
      }

      setLoading(false);
      setLoadProgress(100);
      void colliderMeshUrl;

      cleanup = () => {
        viewer.dispose?.();
        el.innerHTML = "";
      };
    }

    async function run() {
      try {
        const downloadUrl = experienceId
          ? `/api/immersive/splat?experienceId=${experienceId}`
          : selectedUrl!;

        const fileBytes = await downloadWithProgress(
          downloadUrl,
          setLoadProgress,
          abort.signal,
        );

        if (disposed) return;

        if (useSpark) {
          await initSpark(fileBytes);
        } else {
          await initLegacy(fileBytes);
        }
      } catch (err) {
        if (disposed || abort.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load 3D world");
        setLoading(false);
      }
    }

    let completed = false;
    const timeout = window.setTimeout(() => {
      if (!disposed && !completed) {
        setLoadError("Loading timed out. Check your connection and refresh.");
        setLoading(false);
      }
    }, 180_000);

    run()
      .finally(() => {
        completed = true;
        clearTimeout(timeout);
      });

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(animId);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable init; position callback via ref
  }, [experienceId, spz100kUrl, spz500kUrl, spzFullResUrl, worldMarbleUrl, colliderMeshUrl, splatFormat]);

  return (
    <div className="relative h-full w-full min-h-[300px]">
      <div ref={containerRef} className="absolute inset-0 bg-black" />
      {loading && !loadError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-white/80">
            {phase === "download"
              ? `Downloading 3D world… ${loadProgress > 0 ? `${loadProgress}%` : ""}`
              : phase === "decode"
                ? "Preparing viewer…"
                : "Almost ready…"}
          </p>
          <p className="max-w-xs text-center text-xs text-white/50">
            First load is ~35 MB and may take 1–2 minutes.
          </p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !loadError && (
        <p className="absolute bottom-2 left-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white/70">
          Drag to look · Scroll to zoom · Right-drag to pan
        </p>
      )}
    </div>
  );
}
