import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

// ─── Shared geometry + material caches (one per group, not one per node) ────
const SHARED_GEOMETRY: Record<string, THREE.BufferGeometry> = {
  projects:  new THREE.OctahedronGeometry(1.0),
  skills:    new THREE.TorusGeometry(0.5, 0.18, 6, 16),
  systems:   new THREE.DodecahedronGeometry(0.65),
  areas:     new THREE.IcosahedronGeometry(0.6),
  generated: new THREE.TetrahedronGeometry(0.55),
  default:   new THREE.SphereGeometry(0.45, 10, 8),
};

function getSharedGeometry(group: string): THREE.BufferGeometry {
  return SHARED_GEOMETRY[group] ?? SHARED_GEOMETRY.default;
}

interface ConstellationNode {
  id: string;
  label: string;
  group: string;
  val: number;
  color: string;
  x: number;
  y: number;
  z: number;
}

interface ConstellationLink {
  source: string | { id: string };
  target: string | { id: string };
  type: string;
  curvature?: number;
}

function resolveEndpoint(end: string | { id: string }): string {
  return typeof end === "string" ? end : end.id;
}

// Deterministic 3D Orbital Layout Calculator
function calculateOrbitalLayout(rawNodes: any[], rawLinks: any[]): ConstellationNode[] {
  const projects = rawNodes.filter(n => n.group === "projects");
  const nonProjects = rawNodes.filter(n => n.group !== "projects");

  // Define fixed anchor positions for project "suns" - scaled up for a spacious look
  const projectPositions: Record<string, [number, number, number]> = {
    "01_active_project_severus": [-16, 2, 0],
    "02_active_project_upwork":  [16, -2, -5],
    "03_active_project_hermes":  [0, 10, 8]
  };

  // Default layout positions for projects if they are named differently
  const projectList = projects.map((p, index) => {
    const pos = projectPositions[p.id] || [
      Math.sin((index / projects.length) * Math.PI * 2) * 16,
      (index % 2 === 0 ? 1 : -1) * 5,
      Math.cos((index / projects.length) * Math.PI * 2) * 16
    ];
    return { ...p, x: pos[0], y: pos[1], z: pos[2] };
  });

  const projectMap = new Map(projectList.map(p => [p.id, p]));
  const linkMap = new Map<string, string[]>(); // node -> project IDs

  rawLinks.forEach(link => {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;

    if (projectMap.has(src)) {
      if (!linkMap.has(tgt)) linkMap.set(tgt, []);
      linkMap.get(tgt)!.push(src);
    }
    if (projectMap.has(tgt)) {
      if (!linkMap.has(src)) linkMap.set(src, []);
      linkMap.get(src)!.push(tgt);
    }
  });

  // Keep track of how many nodes are assigned to each project to space them out
  const projectCounts: Record<string, number> = {};
  projects.forEach(p => { projectCounts[p.id] = 0; });

  const positionedNonProjects = nonProjects.map((node, index) => {
    const connectedProjects = linkMap.get(node.id) || [];

    let x = 0, y = 0, z = 0;

    if (connectedProjects.length === 1) {
      // Orbit around the single connected project
      const projId = connectedProjects[0];
      const proj = projectMap.get(projId)!;
      const count = projectCounts[projId]++;
      
      // Spherical distribution - spread out further
      const phi = Math.acos(-1 + (2 * count) / (8 + count));
      const theta = count * 2.39; // Golden angle

      const radius = 6.8 + (node.val || 10) * 0.12; // orbit radius based on node size
      x = proj.x + radius * Math.sin(phi) * Math.cos(theta);
      y = proj.y + radius * Math.sin(phi) * Math.sin(theta);
      z = proj.z + radius * Math.cos(phi);
    } else if (connectedProjects.length > 1) {
      // Place between multiple projects (average position)
      let sumX = 0, sumY = 0, sumZ = 0;
      connectedProjects.forEach(pId => {
        const proj = projectMap.get(pId)!;
        sumX += proj.x;
        sumY += proj.y;
        sumZ += proj.z;
      });
      const avgX = sumX / connectedProjects.length;
      const avgY = sumY / connectedProjects.length;
      const avgZ = sumZ / connectedProjects.length;

      // Add a slight deterministic offset to prevent overlaps
      const offsetAngle = index * 1.5;
      x = avgX + Math.cos(offsetAngle) * 3.5;
      y = avgY + Math.sin(offsetAngle) * 3.5;
      z = avgZ + Math.cos(offsetAngle * 2) * 2.5;
    } else {
      // Unconnected node - place in a wider outer belt
      const theta = index * 0.95;
      const radius = 22.0;
      x = radius * Math.cos(theta);
      y = (index % 2 === 0 ? 1 : -1) * (5 + Math.sin(theta) * 4);
      z = radius * Math.sin(theta);
    }

    return { ...node, x, y, z };
  });

  return [...projectList, ...positionedNonProjects];
}

// Individual Stellar Node Mesh Component
function StellarNode({
  node,
  isHovered,
  isSelected,
  filter,
  onPointerOver,
  onPointerOut,
  onClick
}: {
  node: ConstellationNode;
  isHovered: boolean;
  isSelected: boolean;
  filter: string | null;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
}) {
  const isDimmed = useMemo(() => {
    if (!filter) return false;
    return node.group.toLowerCase() !== filter.toLowerCase();
  }, [node.group, filter]);

  // Static scale — animation is lifted to a single parent useFrame.
  const baseScale = (node.val || 10) * 0.06;
  const scale = baseScale * (isHovered ? 1.25 : 1) * (isSelected ? 1.15 : 1);

  const geometry = getSharedGeometry(node.group);

  return (
    <group position={[node.x, node.y, node.z]} scale={scale}>
      <mesh
        geometry={geometry}
        onPointerOver={(e) => {
          if (isDimmed) return;
          e.stopPropagation();
          onPointerOver();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onPointerOut();
        }}
        onClick={(e) => {
          if (isDimmed) return;
          e.stopPropagation();
          onClick();
        }}
      >
        <meshBasicMaterial
          color={node.color}
          transparent={isDimmed}
          opacity={isDimmed ? 0.15 : 1.0}
        />
      </mesh>

      {/* Floating 3D Node Title Labels when hovered/selected */}
      {(isHovered || isSelected || node.group === "projects") && !isDimmed && (
        <Html
          distanceFactor={12}
          position={[0, node.group === "projects" ? 1.5 : 1.0, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`px-2 py-0.5 rounded border text-[10px] font-mono whitespace-nowrap tracking-wider font-bold transition-all duration-300 ${
              isSelected 
                ? "bg-[#D4A017]/90 text-black border-[#D4A017]" 
                : isHovered 
                  ? "bg-black/90 text-white border-white/30" 
                  : "bg-black/60 text-gray-400 border-white/10"
            }`}
            style={{
              boxShadow: isSelected ? "0 0 12px rgba(212,160,23,0.4)" : "none"
            }}
          >
            {node.label}
          </div>
        </Html>
      )}
    </group>
  );
}

// Single merged LineSegments containing every link — one draw call.
function StellarLinks({
  links,
  nodeMap,
}: {
  links: ConstellationLink[];
  nodeMap: Map<string, ConstellationNode>;
}) {
  const lineObject = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const tmpColor = new THREE.Color();

    for (const link of links) {
      const src = nodeMap.get(resolveEndpoint(link.source));
      const tgt = nodeMap.get(resolveEndpoint(link.target));
      if (!src || !tgt) continue;
      positions.push(src.x, src.y, src.z, tgt.x, tgt.y, tgt.z);
      tmpColor.set(src.color);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b, tmpColor.r, tmpColor.g, tmpColor.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
    });
    return new THREE.LineSegments(geometry, material);
  }, [links, nodeMap]);

  return <primitive object={lineObject} />;
}

interface Constellation3DProps {
  nodes: any[];
  links: any[];
  onSelectNode: (node: any) => void;
  selectedNodeId?: string;
  filter?: string | null;
}

// Auto-camera rotation to make the universe feel alive
function ConstellationRig() {
  const { camera, invalidate } = useThree();
  const angleRef = useRef(0);

  useFrame((_, delta) => {
    angleRef.current += delta * 0.04;
    const r = 16;
    camera.position.x = r * Math.sin(angleRef.current);
    camera.position.z = r * Math.cos(angleRef.current);
    camera.lookAt(0, 0, 0);
    invalidate();
  });

  return null;
}

// Trigger a redraw when hover/selection state changes (frameloop is on-demand).
function InvalidateOnHover({ trigger }: { trigger: unknown }) {
  const { invalidate } = useThree();
  useMemo(() => { invalidate(); return null; }, [trigger, invalidate]);
  return null;
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

export default function Constellation3D({
  nodes: rawNodes,
  links: rawLinks,
  onSelectNode,
  selectedNodeId,
  filter
}: Constellation3DProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Compute our high-fidelity 3D orbital system
  const positionedNodes = useMemo(() => {
    return calculateOrbitalLayout(rawNodes, rawLinks);
  }, [rawNodes, rawLinks]);

  const nodeMap = useMemo(() => {
    return new Map(positionedNodes.map(n => [n.id, n]));
  }, [positionedNodes]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 10, 32], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        onPointerDown={() => setAutoRotate(false)}
      >
        <CanvasDisposer />
        {/* Ambient star field — kept small so it does not dominate the budget */}
        <Stars radius={60} depth={20} count={200} factor={3} saturation={0.6} fade speed={0.8} />

        {/* Merged link draw call — one geometry, ~979 segments */}
        <StellarLinks links={rawLinks} nodeMap={nodeMap} />

        {/* Node bodies — shared geometry per group, unlit material */}
        {positionedNodes.map((node) => (
          <StellarNode
            key={node.id}
            node={node}
            isHovered={hoveredNodeId === node.id}
            isSelected={selectedNodeId === node.id}
            filter={filter ?? null}
            onPointerOver={() => setHoveredNodeId(node.id)}
            onPointerOut={() => setHoveredNodeId(null)}
            onClick={() => onSelectNode(node)}
          />
        ))}

        <OrbitControls
          enableZoom
          enablePan
          maxDistance={65}
          minDistance={10}
          makeDefault
        />

        {autoRotate && <ConstellationRig />}
        <InvalidateOnHover trigger={hoveredNodeId} />
      </Canvas>

      {/* 3D View Helper Overlay */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-none select-none">
        <div className="px-2.5 py-1 text-[9px] font-mono text-white/40 border border-white/5 bg-black/60 rounded backdrop-blur flex items-center gap-1.5 shadow-md">
          <div className={`w-1.5 h-1.5 rounded-full ${autoRotate ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
          <span>{autoRotate ? "CINEMATIC RIG" : "MANUAL CONTROL"}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setAutoRotate(prev => !prev);
            }}
            className="pointer-events-auto ml-1.5 hover:text-white transition-colors bg-white/5 border border-white/10 px-1 rounded active:bg-white/10"
          >
            {autoRotate ? "PAUSE" : "PLAY"}
          </button>
        </div>
      </div>
    </div>
  );
}
