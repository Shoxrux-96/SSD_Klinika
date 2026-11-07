import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Bounds, Center } from '@react-three/drei';
import { Box3, Vector3, type Group } from 'three';

function Model() {
  const group = useRef<Group>(null);
  const { scene } = useGLTF('/assets/human.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    const box = new Box3().setFromObject(clonedScene);
    const center = new Vector3();
    box.getCenter(center);
    clonedScene.position.sub(center);
  }, [clonedScene]);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={group}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/assets/human.glb');

export function SkeletonModel() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#ffb59a" />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={0.85}>
          <Center>
            <Model />
          </Center>
        </Bounds>
        <Environment preset="studio" />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.5}
        maxDistance={8}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
