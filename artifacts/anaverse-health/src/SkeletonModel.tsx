import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Bounds, Center, Environment } from '@react-three/drei';
import { Box3, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';

function Model({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF('/assets/human.glb', true, true);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { invalidate } = useThree();

  useLayoutEffect(() => {
    const box = new Box3().setFromObject(clonedScene);
    const center = new Vector3();
    box.getCenter(center);
    clonedScene.position.sub(center);
    // Original material/texture'ni saqlab, faqat yorug'lik parametrlarini
    // biroz oshiramiz — suyak detallari va rang tabiiy ko'rinadi.
    clonedScene.traverse((obj) => {
      const m = obj as Mesh;
      if (!(m as any).isMesh) return;
      const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[];
      const fix = (x: MeshStandardMaterial) => {
        if (!x) return;
        if ((x as any).map) (x as any).map.anisotropy = 4;
        if ((x as any).roughness !== undefined) x.roughness = Math.min(0.75, Math.max(0.4, x.roughness));
        if ((x as any).metalness !== undefined) x.metalness = 0.0;
        if ((x as any).envMapIntensity !== undefined) (x as any).envMapIntensity = 1.2;
        x.needsUpdate = true;
      };
      if (Array.isArray(mat)) mat.forEach(fix);
      else fix(mat as MeshStandardMaterial);
      m.castShadow = false;
      m.receiveShadow = false;
    });
    invalidate();
  }, [clonedScene, invalidate]);

  useFrame((_, delta) => {
    if (animate && group.current) {
      group.current.rotation.y += delta * 0.3;
      invalidate();
    }
  });

  return (
    <group ref={group}>
      <primitive object={clonedScene} />
    </group>
  );
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isSmallScreen() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 760;
}

function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
      }
    }, { rootMargin: '200px 0px', threshold: 0.01, ...options });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

function Fallback({ onEnable }: { onEnable: () => void }) {
  return (
    <button
      type="button"
      onClick={onEnable}
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'transparent', border: '1px dashed rgba(255,200,160,.35)',
        borderRadius: 24, color: '#ffd6c2', cursor: 'pointer', padding: 20,
      }}
      aria-label="3D skelet modelini yoqish"
    >
      <img src="/assets/skeleton-human.png" alt="" loading="lazy" decoding="async"
        style={{ maxHeight: '70%', width: 'auto', opacity: .85, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.4))' }} />
      <span style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700 }}>
        3D modelni yoqish
      </span>
    </button>
  );
}

export function SkeletonModel() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [forced, setForced] = useState(false);
  const [autoLoad] = useState(() => !isSmallScreen() && !prefersReducedMotion());
  const shouldLoad = inView && (autoLoad || forced);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {!shouldLoad ? (
        <Fallback onEnable={() => setForced(true)} />
      ) : (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 35 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          frameloop="demand"
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#ffffff", "#c8bca8", 0.5]} />
          <directionalLight position={[4, 6, 5]} intensity={1.0} />
          <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#fff1e6" />
          <Suspense fallback={null}>
            <Environment preset="studio" />
            <Bounds fit clip observe margin={0.85}>
              <Center>
                <Model animate={autoLoad} />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={1.5}
            maxDistance={8}
            target={[0, 0, 0]}
          />
        </Canvas>
      )}
    </div>
  );
}
