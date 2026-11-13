import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Environment } from '@react-three/drei';
import { Box3, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';

function Model({ targetY }: { targetY: number }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF('/assets/human.glb', true, true);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const metrics = useMemo(() => {
    const box = new Box3().setFromObject(clonedScene);
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);
    return { center, size };
  }, [clonedScene]);

  useLayoutEffect(() => {
    const { center, size } = metrics;
    const bottomY = center.y - size.y / 2;
    const focusY = bottomY + size.y * targetY;
    clonedScene.position.set(-center.x, -focusY, -center.z);
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
    });
  }, [clonedScene, metrics, targetY]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.4;
  });

  return (
    <group ref={group}>
      <primitive object={clonedScene} />
    </group>
  );
}

export function SkeletonFocused({ targetY, distance }: { targetY: number; distance: number }) {
  return (
    <Canvas
      key={`${targetY}-${distance}`}
      camera={{ position: [0, 0, distance], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#c8bca8", 0.5]} />
      <directionalLight position={[4, 6, 5]} intensity={1.0} />
      <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#fff1e6" />
      <Suspense fallback={null}>
        <Environment preset="studio" />
        <Center disableY>
          <Model targetY={targetY} />
        </Center>
      </Suspense>
      <OrbitControls enablePan={false} enableZoom minDistance={1} maxDistance={6} target={[0, 0, 0]} />
    </Canvas>
  );
}
