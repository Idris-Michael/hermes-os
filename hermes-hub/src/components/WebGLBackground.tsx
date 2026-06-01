import { useRef, useMemo, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, Text, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

// Guards EffectComposer + its passes against null-pass crashes during
// WebGL context lifecycle (StrictMode double-mount, route remount, HMR).
// If postprocessing fails, render children without effects — never crash the route.
class PostFXBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — scene continues without bloom/aberration */ }
  render() { return this.state.failed ? null : this.props.children; }
}

// Moving glowing neon grid to give a cyberpunk vibe
function NeonGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = (state.clock.elapsedTime * 2) % 10;
    }
  });

  return (
    <group position={[0, -5, 0]}>
      <gridHelper ref={gridRef} args={[100, 100, '#00ffcc', '#002233']} />
      {/* Second grid slightly offset to create a denser look */}
      <gridHelper args={[100, 100, '#00ffcc', '#002233']} position={[0, -0.01, -5]} />
    </group>
  );
}

function Nanobanana() {
  const texture = useTexture('/nanobanana.png');
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Subtle pulsing glow
  useFrame((state) => {
    if (materialRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.5 + 0.5;
      materialRef.current.emissiveIntensity = 0.5 + pulse * 1.5;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1} position={[0, 0, 0]}>
      <mesh>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial
          ref={materialRef}
          map={texture}
          transparent
          emissive={new THREE.Color('#00ffcc')}
          emissiveMap={texture}
          emissiveIntensity={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  );
}

function CyberParticles() {
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20 + 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#ff00cc" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

// Explicitly dispose the WebGL context + renderer on unmount. Without this,
// StrictMode (and route changes that remount the Canvas) leak a context per
// navigation; browsers cap ~16 active contexts, so the whole app blanks after
// ~8 navigations.
function CanvasDisposer() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      try {
        gl.dispose();
        const loseCtx = gl.getContext().getExtension('WEBGL_lose_context');
        loseCtx?.loseContext();
      } catch { /* renderer already torn down */ }
    };
  }, [gl]);
  return null;
}

export default function WebGLBackground({ showModel = true }: { showModel?: boolean }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none bg-[#030014]">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <CanvasDisposer />
        <color attach="background" args={['#030014']} />

        <ambientLight intensity={0.5} />
        <spotLight position={[0, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#00ffcc" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ff00cc" />

        <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

        <NeonGrid />
        {showModel && <Nanobanana />}
        <CyberParticles />

        <PostFXBoundary>
          <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
            {/* @ts-ignore */}
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.002, 0.002]} />
          </EffectComposer>
        </PostFXBoundary>
      </Canvas>
    </div>
  );
}
