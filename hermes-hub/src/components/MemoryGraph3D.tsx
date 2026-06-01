import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

interface MemNode { id: string; name: string; type: string; }
interface SimNode3D extends MemNode { x: number; y: number; z: number; vx: number; vy: number; vz: number; }

const NODE_COLOR: Record<string, string> = {
  "memory core": "#22c55e",
  workspace: "#9ca3af", workspaces: "#9ca3af",
  decisions: "#60a5fa", sessions: "#818cf8", skills: "#f472b6",
  stale: "#f97316", missing: "#6b7280",
  feedback: "#f59e0b", project: "#34d399",
  reference: "#a78bfa", user: "#60a5fa",
};

const NODE_SIZE: Record<string, number> = {
  "memory core": 2.5, decisions: 1.2, sessions: 1,
  skills: 1.2, feedback: 1.2, project: 1.2, reference: 1,
};

function settleForce3D(nodes: MemNode[], size = 30): SimNode3D[] {
  const sim: SimNode3D[] = nodes.map(n => ({
    ...n,
    x: n.type === "memory core" ? 0 : (Math.random() - 0.5) * size,
    y: n.type === "memory core" ? 0 : (Math.random() - 0.5) * size,
    z: n.type === "memory core" ? 0 : (Math.random() - 0.5) * size,
    vx: 0, vy: 0, vz: 0,
  }));

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < sim.length; i++) {
      const a = sim[i];
      for (let j = i + 1; j < sim.length; j++) {
        const b = sim[j];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const distSq = dx * dx + dy * dy + dz * dz || 0.1;
        const dist = Math.sqrt(distSq);
        const f = 50 / distSq;
        a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f; a.vz -= (dz / dist) * f;
        b.vx += (dx / dist) * f; b.vy += (dy / dist) * f; b.vz += (dz / dist) * f;
      }
      a.vx += (-a.x) * 0.01;
      a.vy += (-a.y) * 0.01;
      a.vz += (-a.z) * 0.01;
      a.vx *= 0.8; a.vy *= 0.8; a.vz *= 0.8;
      
      if (a.type !== "memory core") {
        a.x += a.vx;
        a.y += a.vy;
        a.z += a.vz;
      }
    }
  }
  return sim;
}

function GraphScene({ nodes }: { nodes: MemNode[] }) {
  const simNodes = useMemo(() => settleForce3D(nodes), [nodes]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
    }
  });

  const lines = useMemo(() => {
    const pts = [];
    const colors = [];
    for (let i = 0; i < simNodes.length; i++) {
      const a = simNodes[i];
      const neighbors = simNodes
        .filter((_, j) => j !== i)
        .sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y, x.z - a.z) - Math.hypot(y.x - a.x, y.y - a.y, y.z - a.z))
        .slice(0, 2);
      
      const colorA = new THREE.Color(NODE_COLOR[a.type.toLowerCase()] || "#9ca3af");
      for (const b of neighbors) {
        pts.push(a.x, a.y, a.z);
        pts.push(b.x, b.y, b.z);
        colors.push(colorA.r, colorA.g, colorA.b);
        colors.push(colorA.r, colorA.g, colorA.b);
      }
    }
    return { pts: new Float32Array(pts), colors: new Float32Array(colors) };
  }, [simNodes]);

  return (
    <group ref={groupRef}>
      {simNodes.map((n) => {
        const color = NODE_COLOR[n.type.toLowerCase()] || "#9ca3af";
        const size = NODE_SIZE[n.type.toLowerCase()] || 1;
        return (
          <group key={n.id} position={[n.x, n.y, n.z]}>
            <mesh>
              <sphereGeometry args={[size, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </mesh>
            <mesh>
              <sphereGeometry args={[size * 1.5, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
            </mesh>
            <Billboard follow lockX={false} lockY={false} lockZ={false}>
              <Text position={[0, size + 0.8, 0]} fontSize={0.6} color="#ffffff" anchorX="center" anchorY="middle">
                {n.name.substring(0, 15)}
              </Text>
            </Billboard>
          </group>
        );
      })}
      
      {lines.pts.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={lines.pts.length / 3} array={lines.pts} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={lines.colors.length / 3} array={lines.colors} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.3} />
        </lineSegments>
      )}
    </group>
  );
}

function CanvasDisposer() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      try {
        gl.dispose();
        const loseCtx = gl.getContext().getExtension("WEBGL_lose_context");
        loseCtx?.loseContext();
      } catch { /* already torn down */ }
    };
  }, [gl]);
  return null;
}

export default function MemoryGraph3D({ nodes }: { nodes: MemNode[] }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div className="w-full h-full absolute inset-0 mix-blend-screen pointer-events-auto">
      <Canvas camera={{ position: [0, 0, 35], fov: 45 }}>
        <CanvasDisposer />
        <ambientLight intensity={0.5} />
        <GraphScene nodes={nodes} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
