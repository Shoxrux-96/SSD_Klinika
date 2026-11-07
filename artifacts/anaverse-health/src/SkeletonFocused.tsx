import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Center } from '@react-three/drei';
import { Box3, Vector3, type Group } from 'three';

function Model({ targetY }: { targetY: number }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF('/assets/human.glb');
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

useGLTF.preload('/assets/human.glb');

export function SkeletonFocused({ targetY, distance }: { targetY: number; distance: number }) {
  return (
    <Canvas
      key={`${targetY}-${distance}`}
      camera={{ position: [0, 0, distance], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#ffb59a" />
      <Suspense fallback={null}>
        <Center disableY>
          <Model targetY={targetY} />
        </Center>
        <Environment preset="studio" />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom minDistance={1} maxDistance={6} target={[0, 0, 0]} />
    </Canvas>
  );
}
