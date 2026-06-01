import React, { useState, useEffect, useRef, useCallback, useMemo, Component, type ReactNode } from "react";

// Guards Bloom/EffectComposer against null-pass crashes during WebGL context lifecycle.
class PostFXBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? null : this.props.children; }
}
import { 
  ExternalLink, 
  BookOpen, 
  GitBranch, 
  Folder, 
  Info, 
  Layers, 
  RefreshCw, 
  FileText, 
  Search, 
  Sparkles, 
  Database,
  Sliders,
  ChevronRight,
  Maximize2,
  Compass,
  Zap,
  Globe
} from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Text, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import ParallaxTiltCard from "../components/ParallaxTiltCard";
import { useConstellation } from "../hooks/queries";
import { useQuery } from "@tanstack/react-query";

// Interfaces for local repository and Obsidian Vault data
interface RepoSummary {
  name: string;
  path: string;
  description: string;
  purpose: string;
  relevance: string;
  color: string;
  icon: string;
}

interface VaultFile {
  name: string;
  path: string;
  mtime: number;
}

interface VaultSection {
  section: string;
  path: string;
  files: VaultFile[];
}

interface KBData {
  repos: RepoSummary[];
  vault: VaultSection[];
}

// 3D Simulation Node representation
interface SimNode3D {
  id: string;
  name: string;
  type: string;
  color: string;
  val: number;
  // Settle target coordinates
  x: number;
  y: number;
  z: number;
  path?: string;
  description?: string;
  purpose?: string;
  relevance?: string;
  icon?: string;
}

interface SimLink {
  source: string;
  target: string;
  distance: number;
}

const REPO_META: Record<string, Pick<RepoSummary, "description" | "purpose" | "relevance" | "color" | "icon">> = {
  "jcodemunch-mcp": {
    description: "Tree-sitter AST codebase indexer MCP server",
    purpose: "95% token reduction via symbol-level code lookup",
    relevance: "Core infrastructure — all code navigation uses this",
    color: "#22c55e",
    icon: "🧩",
  },
  "mattpocock-skills": {
    description: "Composable real-engineering agent skills by Matt Pocock",
    purpose: "Small, hackable, model-agnostic skills for actual dev work",
    relevance: "Reference for building /sc skill commands",
    color: "#60a5fa",
    icon: "⚡",
  },
  "andrej-karpathy-skills": {
    description: "4-principle CLAUDE.md from Karpathy's LLM pitfall observations",
    purpose: "Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven",
    relevance: "Source of Hermes Architectural Laws #1–3",
    color: "#f472b6",
    icon: "🧠",
  },
  "clean-code-skills": {
    description: "66 Robert C. Martin Clean Code rules as agent skills",
    purpose: "Python + TypeScript tracks — boy-scout orchestrator",
    relevance: "Applies directly to severus-social, hermes-hub TypeScript code",
    color: "#f59e0b",
    icon: "✨",
  },
  rtk: {
    description: "Rust Token Killer — CLI proxy compressing output 60–90%",
    purpose: "Filters shell stdout before it hits LLM context",
    relevance: "Mandatory — all shell calls prefixed with `rtk`",
    color: "#ef4444",
    icon: "🦀",
  },
};

// Math coordinate utilities for parametric shape generation (N = 4000 points)
const getSpherePoint = (i: number, N: number, scale = 11) => {
  const phi = Math.acos(-1 + (2 * i) / N);
  const theta = Math.sqrt(N * Math.PI) * phi;
  return new THREE.Vector3(
    scale * Math.cos(theta) * Math.sin(phi),
    scale * Math.sin(theta) * Math.sin(phi),
    scale * Math.cos(phi)
  );
};

const getCubePoint = (i: number, N: number, scale = 12) => {
  const side = Math.ceil(Math.pow(N, 1 / 3));
  const z = Math.floor(i / (side * side));
  const y = Math.floor((i % (side * side)) / side);
  const x = i % side;
  const offset = side / 2;
  const spacing = scale / side;
  return new THREE.Vector3(
    (x - offset) * spacing * 1.5,
    (y - offset) * spacing * 1.5,
    (z - offset) * spacing * 1.5
  );
};

const getHelixPoint = (i: number, N: number, scale = 15) => {
  const r = 5.5;
  const turns = 7;
  const theta = (i / N) * Math.PI * 2 * turns;
  const y = (i / N) * scale - scale / 2;
  const offset = i % 2 === 0 ? 0 : Math.PI;
  return new THREE.Vector3(
    r * Math.cos(theta + offset),
    y * 1.2,
    r * Math.sin(theta + offset)
  );
};

const getDonutPoint = (i: number, N: number, scale = 10) => {
  const R = 8.0;
  const r = 3.5;
  const u = (i / N) * Math.PI * 2 * 25;
  const v = (i / N) * Math.PI * 2;
  return new THREE.Vector3(
    (R + r * Math.cos(u)) * Math.cos(v),
    (R + r * Math.cos(u)) * Math.sin(v),
    r * Math.sin(u)
  );
};

// 3D Settle Force-directed engine to compute node locations
const run3DForceSettlement = (nodes: SimNode3D[], links: SimLink[], iterations = 180) => {
  // Initialize nodes randomly in a sphere - scaled up for spacing
  nodes.forEach((n, i) => {
    if (n.type === "core") {
      n.x = 0; n.y = 0; n.z = 0;
    } else {
      const phi = Math.acos(-1 + (2 * i) / nodes.length);
      const theta = Math.sqrt(nodes.length * Math.PI) * phi;
      const radius = n.type === "repo" ? 14 : n.type === "section" ? 22 : 32;
      n.x = radius * Math.cos(theta) * Math.sin(phi);
      n.y = radius * Math.sin(theta) * Math.sin(phi);
      n.z = radius * Math.cos(phi);
    }
  });

  // Iterative settlement
  for (let step = 0; step < iterations; step++) {
    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dz = n2.z - n1.z;
        const dist = Math.hypot(dx, dy, dz) || 1;
        // Larger minimum distance between nodes to force wider spacing
        const minDist = (n1.type === "core" ? 12 : 5) + (n2.type === "core" ? 12 : 5) + 6.0;
        if (dist < minDist) {
          const force = (minDist - dist) * 0.15;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          if (n1.type !== "core") {
            n1.x -= fx; n1.y -= fy; n1.z -= fz;
          }
          if (n2.type !== "core") {
            n2.x += fx; n2.y += fy; n2.z += fz;
          }
        }
      }
    }

    // 2. Attraction spring force along links
    links.forEach(l => {
      const s = nodes.find(n => n.id === l.source);
      const t = nodes.find(n => n.id === l.target);
      if (!s || !t) return;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dz = t.z - s.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const force = (dist - (l.distance / 4)) * 0.08;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      if (s.type !== "core") {
        s.x += fx; s.y += fy; s.z += fz;
      }
      if (t.type !== "core") {
        t.x -= fx; t.y -= fy; t.z -= fz;
      }
    });

    // 3. Gravity pulling nodes toward the core center
    nodes.forEach(n => {
      if (n.type === "core") return;
      const d = Math.hypot(n.x, n.y, n.z) || 1;
      const pull = 0.01;
      n.x -= (n.x / d) * pull;
      n.y -= (n.y / d) * pull;
      n.z -= (n.z / d) * pull;
    });
  }
};

// High-performance particle swarm morphing component
interface SwarmParticlesProps {
  count: number;
  nodes: SimNode3D[];
  formation: "constellation" | "sphere" | "cube" | "helix" | "donut";
  particleSize: number;
  animSpeed: number;
  breathingMagnitude: number;
  breathingFreq: number;
  handWaveMagnitude: number;
  handWaveFreq: number;
}

function SwarmParticles({
  count,
  nodes,
  formation,
  particleSize,
  animSpeed,
  breathingMagnitude,
  breathingFreq,
  handWaveMagnitude,
  handWaveFreq
}: SwarmParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate targets and cache them for fast interpolation inside useFrame
  const targets = useMemo(() => {
    const sphereArr = new Float32Array(count * 3);
    const cubeArr = new Float32Array(count * 3);
    const helixArr = new Float32Array(count * 3);
    const donutArr = new Float32Array(count * 3);
    const constellationArr = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Geodesic Sphere
      const sp = getSpherePoint(i, count);
      sphereArr[i3] = sp.x; sphereArr[i3 + 1] = sp.y; sphereArr[i3 + 2] = sp.z;

      // Volumetric Cube
      const cb = getCubePoint(i, count);
      cubeArr[i3] = cb.x; cubeArr[i3 + 1] = cb.y; cubeArr[i3 + 2] = cb.z;

      // DNA Double Helix
      const hx = getHelixPoint(i, count);
      helixArr[i3] = hx.x; helixArr[i3 + 1] = hx.y; helixArr[i3 + 2] = hx.z;

      // Torus Donut
      const donutPoint = getDonutPoint(i, count);
      donutArr[i3] = donutPoint.x; donutArr[i3 + 1] = donutPoint.y; donutArr[i3 + 2] = donutPoint.z;

      // Constellation: cluster particles around graph nodes
      if (nodes.length > 0) {
        const nodeIndex = i % nodes.length;
        const node = nodes[nodeIndex];
        // Distribute in a spherical cloud around the node position
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        // Radius scales with importance of node
        const r = (Math.random() * 0.7 + 0.1) * (node.val / 12);
        
        const dx = r * Math.sin(phi) * Math.cos(theta);
        const dy = r * Math.sin(phi) * Math.sin(theta);
        const dz = r * Math.cos(phi);

        constellationArr[i3] = node.x + dx;
        constellationArr[i3 + 1] = node.y + dy;
        constellationArr[i3 + 2] = node.z + dz;
      }
    }

    return {
      sphere: sphereArr,
      cube: cubeArr,
      helix: helixArr,
      donut: donutArr,
      constellation: constellationArr
    };
  }, [count, nodes]);

  // Create custom shader material with uTime and animation parameters
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBreathingMagnitude: { value: breathingMagnitude },
        uBreathingFreq: { value: breathingFreq },
        uHandWaveMagnitude: { value: handWaveMagnitude },
        uHandWaveFreq: { value: handWaveFreq },
        uParticleSize: { value: particleSize },
        uColor: { value: new THREE.Color("#2dd4bf") },
        uOpacity: { value: 0.7 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBreathingMagnitude;
        uniform float uBreathingFreq;
        uniform float uHandWaveMagnitude;
        uniform float uHandWaveFreq;
        uniform float uParticleSize;

        void main() {
          float breath = 1.0 + sin(uTime * uBreathingFreq + (position.x + position.y) * 0.1) * uBreathingMagnitude;
          float wave = sin(uTime * uHandWaveFreq + position.x * 0.2) * uHandWaveMagnitude;

          vec3 finalPos = position * breath;
          finalPos.y += wave * breath;

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uParticleSize * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;

        void main() {
          vec2 temp = gl_PointCoord - vec2(0.5);
          float dist = length(temp);
          if (dist > 0.5) discard;
          gl_FragColor = vec4(uColor, uOpacity * (1.0 - dist * 2.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [breathingMagnitude, breathingFreq, handWaveMagnitude, handWaveFreq, particleSize]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const geom = pointsRef.current.geometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    if (!posAttr) return;

    const arr = posAttr.array as Float32Array;
    const targetArr = targets[formation] || targets.constellation;

    let changed = false;
    for (let i = 0; i < count * 3; i++) {
      const diff = targetArr[i] - arr[i];
      if (Math.abs(diff) > 0.005) {
        arr[i] += diff * animSpeed;
        changed = true;
      } else if (arr[i] !== targetArr[i]) {
        arr[i] = targetArr[i];
        changed = true;
      }
    }

    if (changed) {
      posAttr.needsUpdate = true;
    }

    // Update shader uniforms
    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    if (mat && mat.uniforms) {
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uBreathingMagnitude.value = breathingMagnitude;
      mat.uniforms.uBreathingFreq.value = breathingFreq;
      mat.uniforms.uHandWaveMagnitude.value = handWaveMagnitude;
      mat.uniforms.uHandWaveFreq.value = handWaveFreq;
      mat.uniforms.uParticleSize.value = particleSize;
    }
  });

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const pt = getSpherePoint(i, count, 20);
      arr[i * 3] = pt.x;
      arr[i * 3 + 1] = pt.y;
      arr[i * 3 + 2] = pt.z;
    }
    return arr;
  }, [count]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}

// Glowing line links segments renderer
interface LinksRendererProps {
  links: SimLink[];
  nodePositionsRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  formation: string;
}

function LinksRenderer({ links, nodePositionsRef, formation }: LinksRendererProps) {
  const ref = useRef<any>(null);

  useFrame(() => {
    if (!ref.current) return;
    const geom = ref.current.geometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    if (!posAttr) return;

    const arr = posAttr.array as Float32Array;
    let idx = 0;

    links.forEach(link => {
      const sPos = nodePositionsRef.current[link.source];
      const tPos = nodePositionsRef.current[link.target];
      if (sPos && tPos) {
        arr[idx++] = sPos.x;
        arr[idx++] = sPos.y;
        arr[idx++] = sPos.z;
        arr[idx++] = tPos.x;
        arr[idx++] = tPos.y;
        arr[idx++] = tPos.z;
      } else {
        arr[idx++] = 0; arr[idx++] = 0; arr[idx++] = 0;
        arr[idx++] = 0; arr[idx++] = 0; arr[idx++] = 0;
      }
    });

    posAttr.needsUpdate = true;
  });

  const positions = useMemo(() => new Float32Array(links.length * 2 * 3), [links.length]);

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={links.length * 2}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial 
        color="#2dd4bf" 
        transparent 
        opacity={formation === "constellation" ? 0.35 : 0.04} 
        blending={THREE.AdditiveBlending}
        depthWrite={false} 
      />
    </lineSegments>
  );
}

// Individual 3D Node mesh sphere renderer
interface NodeMesh3DProps {
  node: SimNode3D;
  targetPos: THREE.Vector3;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  nodePositionsRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  formation: string;
  dimmed: boolean;
}

function NodeMesh3D({
  node,
  targetPos,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
  nodePositionsRef,
  formation,
  dimmed
}: NodeMesh3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!groupRef.current) return;
    // Morph node coordinate into target position smoothly
    groupRef.current.position.lerp(targetPos, 0.08);
    // Write animated position to shared layout dictionary
    nodePositionsRef.current[node.id] = groupRef.current.position.clone();
  });

  const scale = node.type === "core" ? 1.0 : node.type === "repo" ? 0.75 : node.type === "section" ? 0.55 : 0.35;
  const finalOpacity = dimmed ? 0.15 : isHovered ? 0.95 : 0.7;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut();
      }}
    >
      {/* Glow Specular Sphere */}
      <mesh>
        <sphereGeometry args={[0.35 * scale, 16, 16]} />
        <meshBasicMaterial 
          color={node.color} 
          transparent 
          opacity={finalOpacity}
        />
      </mesh>

      {/* Orbit Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5 * scale, 0.58 * scale, 32]} />
        <meshBasicMaterial 
          color={node.color} 
          transparent 
          opacity={isSelected ? 0.9 : isHovered ? 0.6 : 0.25} 
          side={THREE.DoubleSide} 
        />
      </mesh>

      {/* Dashed outer selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.75 * scale, 0.79 * scale, 4]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Billboard textual overlays */}
      <Billboard>
        <Text
          position={[0, 0.65 * scale + 0.3, 0]}
          fontSize={0.25}
          color={isSelected ? "#ffffff" : isHovered ? "#2dd4bf" : "#a1a1aa"}
          anchorX="center"
          anchorY="middle"
          visible={formation === "constellation" || isHovered || isSelected}
        >
          {node.name}
        </Text>
      </Billboard>
    </group>
  );
}

// Scene assembly
interface SceneContentProps {
  nodes: SimNode3D[];
  links: SimLink[];
  formation: "constellation" | "sphere" | "cube" | "helix" | "donut";
  hoveredNode: SimNode3D | null;
  selectedNode: SimNode3D | null;
  setSelectedNode: (n: SimNode3D | null) => void;
  setHoveredNode: (n: SimNode3D | null) => void;
  particleSize: number;
  animSpeed: number;
  breathingMagnitude: number;
  breathingFreq: number;
  handWaveMagnitude: number;
  handWaveFreq: number;
  spinSpeed: number;
  search: string;
  filterType: string;
}

function SceneContent({
  nodes,
  links,
  formation,
  hoveredNode,
  selectedNode,
  setSelectedNode,
  setHoveredNode,
  particleSize,
  animSpeed,
  breathingMagnitude,
  breathingFreq,
  handWaveMagnitude,
  handWaveFreq,
  spinSpeed,
  search,
  filterType
}: SceneContentProps) {
  const nodePositionsRef = useRef<Record<string, THREE.Vector3>>({});
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle automatic rotation of the whole rig
      groupRef.current.rotation.y = state.clock.getElapsedTime() * spinSpeed;
    }
  });

  // Calculate target positions for morphing nodes based on current shape state
  const nodeTargets = useMemo(() => {
    const targets: Record<string, THREE.Vector3> = {};
    if (nodes.length === 0) return targets;

    nodes.forEach((node, idx) => {
      if (formation === "constellation") {
        targets[node.id] = new THREE.Vector3(node.x, node.y, node.z);
      } else if (formation === "sphere") {
        const spherePt = getSpherePoint(idx * Math.floor(4000 / nodes.length), 4000);
        targets[node.id] = spherePt;
      } else if (formation === "cube") {
        const cubePt = getCubePoint(idx * Math.floor(4000 / nodes.length), 4000);
        targets[node.id] = cubePt;
      } else if (formation === "helix") {
        const helixPt = getHelixPoint(idx * Math.floor(4000 / nodes.length), 4000);
        targets[node.id] = helixPt;
      } else if (formation === "donut") {
        const donutPt = getDonutPoint(idx * Math.floor(4000 / nodes.length), 4000);
        targets[node.id] = donutPt;
      }
    });

    return targets;
  }, [nodes, formation]);

  const searchLower = search.toLowerCase();
  const isSearching = searchLower.length > 1;

  const isNodeMatch = (n: SimNode3D) => {
    if (n.type === "core") return true;
    return n.name.toLowerCase().includes(searchLower);
  };

  const isFilteredOut = (n: SimNode3D) => {
    if (n.type === "core") return false;
    if (filterType !== "all" && n.type !== filterType) return true;
    return false;
  };

  return (
    <group ref={groupRef}>
      {/* 3D Morphing Points Cloud */}
      <SwarmParticles
        count={4000}
        nodes={nodes}
        formation={formation}
        particleSize={particleSize}
        animSpeed={animSpeed}
        breathingMagnitude={breathingMagnitude}
        breathingFreq={breathingFreq}
        handWaveMagnitude={handWaveMagnitude}
        handWaveFreq={handWaveFreq}
      />

      {/* Glowing Links Segment Network */}
      <LinksRenderer
        links={links}
        nodePositionsRef={nodePositionsRef}
        formation={formation}
      />

      {/* Nodes Array rendering */}
      {nodes.map((node) => {
        const targetPos = nodeTargets[node.id] || new THREE.Vector3(node.x, node.y, node.z);
        const match = isSearching ? isNodeMatch(node) : true;
        const filter = isFilteredOut(node);
        const dimmed = (isSearching && !match) || filter;

        return (
          <NodeMesh3D
            key={node.id}
            node={node}
            targetPos={targetPos}
            isSelected={selectedNode?.id === node.id}
            isHovered={hoveredNode?.id === node.id}
            onClick={() => setSelectedNode(node)}
            onPointerOver={() => setHoveredNode(node)}
            onPointerOut={() => setHoveredNode(null)}
            nodePositionsRef={nodePositionsRef}
            formation={formation}
            dimmed={dimmed}
          />
        );
      })}
    </group>
  );
}

// ── Studio Outputs Panel ─────────────────────────────────────────────────────

interface StudioExports {
  csv_ready: boolean;
  csv_rows: number;
  mindmap_ready: boolean;
  manifest_ready: boolean;
  manifest: {
    generated_at?: string;
    slides?: Array<{
      index: number;
      service: string;
      status: string;
      priority: string;
      rendered: boolean;
    }>;
  } | null;
}

function StudioPanel() {
  const [exports, setExports] = useState<StudioExports | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderLog, setRenderLog] = useState<string | null>(null);

  const loadExports = useCallback(() => {
    fetch("/api/studio/exports")
      .then((r) => r.json())
      .then(setExports)
      .catch(() => {});
  }, []);

  useEffect(() => { loadExports(); }, [loadExports]);

  const handleRender = () => {
    setRendering(true);
    setRenderLog(null);
    fetch("/api/studio/render", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        setRenderLog(d.message || "Render started");
        setTimeout(() => { loadExports(); setRendering(false); }, 3000);
      })
      .catch(() => { setRenderLog("Render failed"); setRendering(false); });
  };

  const priorityColor = (p: string) => {
    const n = parseInt(p) || 5;
    if (n >= 9) return "#22c55e";
    if (n >= 7) return "#f59e0b";
    return "#6b7280";
  };

  return (
    <div className="mt-5 pt-4 border-t border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-[#D4A017] drop-shadow-[0_0_8px_#D4A017]" />
          <span className="text-[9px] tracking-[0.15em] uppercase text-gray-500 font-mono">
            Studio Outputs — Hyperframes Pipeline
          </span>
        </div>

        <div className="flex items-center gap-3">
          {exports && (
            <div className="flex items-center gap-2 text-[8px] font-mono text-gray-500">
              <span className={exports.csv_ready ? "text-emerald-400" : "text-gray-600"}>
                CSV {exports.csv_ready ? `✓ ${exports.csv_rows}r` : "—"}
              </span>
              <span className={exports.mindmap_ready ? "text-emerald-400" : "text-gray-600"}>
                Map {exports.mindmap_ready ? "✓" : "—"}
              </span>
              <span className={exports.manifest_ready ? "text-emerald-400" : "text-gray-600"}>
                Manifest {exports.manifest_ready ? "✓" : "—"}
              </span>
            </div>
          )}

          <button
            onClick={handleRender}
            disabled={rendering || !exports?.csv_ready || !exports?.mindmap_ready}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wide transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed
              bg-[#D4A017]/10 border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017]/20 hover:shadow-[0_0_12px_rgba(212,160,23,0.3)]"
          >
            {rendering ? (
              <RefreshCw size={10} className="animate-spin" />
            ) : (
              <Sparkles size={10} />
            )}
            {rendering ? "Rendering..." : "Render Slides"}
          </button>
        </div>
      </div>

      {renderLog && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] text-[9px] font-mono text-emerald-400">
          {renderLog}
        </div>
      )}

      {exports?.manifest?.slides && exports.manifest.slides.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {exports.manifest.slides.map((slide) => (
            <div
              key={slide.index}
              className="p-3 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono text-gray-600">#{slide.index}</span>
                <span
                  className="text-[8px] font-bold font-mono"
                  style={{ color: priorityColor(slide.priority) }}
                >
                  P{slide.priority}
                </span>
              </div>
              <div className="text-[9px] font-mono text-gray-300 font-medium truncate mb-1">{slide.service}</div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${slide.rendered ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-gray-600"}`}
                />
                <span className="text-[8px] font-mono text-gray-500">{slide.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {[
            { service: "Instagram Pipeline", priority: "10", status: "LIVE" },
            { service: "Upwork GA4", priority: "9", status: "Phase 1" },
            { service: "rtk", priority: "9", status: "Cloned" },
            { service: "Obsidian Memory", priority: "8", status: "Live" },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-xl border border-white/[0.04] bg-black/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono text-gray-700">#{i + 1}</span>
                <span className="text-[8px] font-bold font-mono" style={{ color: priorityColor(s.priority) }}>
                  P{s.priority}
                </span>
              </div>
              <div className="text-[9px] font-mono text-gray-500 truncate mb-1">{s.service}</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
                <span className="text-[8px] font-mono text-gray-600">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_KB: KBData = { repos: [], vault: [] };
const EMPTY_CONSTEL: { nodes: any[]; links: any[] } = { nodes: [], links: [] };

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "projects" | "skills" | "areas" | "systems" | "generated">("all");

  // Swarm physical control parameters (inspired by Casberry Particles)
  const [formation, setFormation] = useState<"constellation" | "sphere" | "cube" | "helix" | "donut">("constellation");
  const [particleSize, setParticleSize] = useState(0.08);
  const [animSpeed, setAnimSpeed] = useState(0.06);
  const [breathingMagnitude, setBreathingMagnitude] = useState(0.05);
  const [breathingFreq, setBreathingFreq] = useState(1.2);
  const [handWaveMagnitude, setHandWaveMagnitude] = useState(0.15);
  const [handWaveFreq, setHandWaveFreq] = useState(1.5);
  const [spinSpeed, setSpinSpeed] = useState(0.015);

  const [selectedNode, setSelectedNode] = useState<SimNode3D | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode3D | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Vault repos: single consumer, kept as a TanStack Query for caching + retry.
  const { data: vaultReposData, isLoading: vaultLoading } = useQuery({
    queryKey: ["vault-repos"],
    queryFn: async () => {
      const r = await fetch("/api/vault/repos");
      if (!r.ok) throw new Error(`vault/repos → ${r.status}`);
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
  // Constellation: shared cache with MemoryPage.
  const { data: constellationQueryData, isLoading: constellationLoading } = useConstellation();

  const data: KBData = vaultReposData ?? EMPTY_KB;
  const constellationData = constellationQueryData ?? EMPTY_CONSTEL;
  const loading = vaultLoading && constellationLoading;

  // Compute 3D node and links constellation structure using settled physics engine
  const { nodes3D, links3D } = useMemo(() => {
    if (loading || !constellationData.nodes) return { nodes3D: [], links3D: [] };

    const nodes: SimNode3D[] = [];
    const links: SimLink[] = [];

    // Core root stellar node
    nodes.push({
      id: "core_hermes",
      name: "Hermes OS",
      type: "core",
      color: "#a855f7",
      val: 32,
      x: 0, y: 0, z: 0,
      description: "Hermes OS Core Knowledge Base & Vault Center",
      icon: "🧠",
    });

    // Map constellation JSON nodes
    constellationData.nodes.forEach((n) => {
      nodes.push({
        id: n.id,
        name: n.label,
        type: n.group, // projects, skills, areas, systems, generated
        color: n.color || "#818cf8",
        val: n.val || 12,
        x: 0, y: 0, z: 0,
        description: n.description || `Entity in Hermes OS ${n.group} taxonomy`,
        icon: n.icon || (n.group === "projects" ? "📁" : n.group === "skills" ? "⚡" : n.group === "systems" ? "🧩" : n.group === "areas" ? "🌐" : "📄"),
      });

      // Tether projects, systems, areas to the center core
      links.push({
        source: "core_hermes",
        target: n.id,
        distance: n.group === "projects" ? 70 : n.group === "systems" ? 95 : 120,
      });
    });

    // Map constellation JSON links
    constellationData.links.forEach((l) => {
      links.push({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
        distance: 60, // Tighter distance for semantic relations
      });
    });

    // Compute settled, deterministic 3D force coordinates
    run3DForceSettlement(nodes, links);

    return { nodes3D: nodes, links3D: links };
  }, [constellationData, loading]);

  // Track mouse coordinates for floating node cards
  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (hoveredNode) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Dynamic signals calculations (most recently modified files in vault)
  const latestSignals = useMemo(() => {
    const allFiles: { name: string; path: string; mtime: number; section: string }[] = [];
    data.vault.forEach((sec) => {
      sec.files.forEach((f) => {
        allFiles.push({ ...f, section: sec.section });
      });
    });
    return allFiles.sort((a, b) => b.mtime - a.mtime).slice(0, 3);
  }, [data.vault]);

  const stats = useMemo(() => {
    const totalFiles = data.vault.reduce((acc, s) => acc + s.files.length, 0);
    return {
      nodes: nodes3D.length || 24,
      repos: data.repos.length,
      files: totalFiles,
    };
  }, [data, nodes3D, loading]);

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white bg-[#020503]">
      
      {/* Retro Brand Text rotated -90deg */}
      <div 
        className="absolute left-4 top-1/2 -translate-y-1/2 rotate(-90deg) origin-center font-display text-[10px] tracking-[0.3em] uppercase text-[#D4A017] whitespace-nowrap opacity-60 pointer-events-none select-none z-10"
        style={{ transform: "translateY(-50%) rotate(-90deg)" }}
      >
        KNOWLEDGE CONSTELLATION 3D
      </div>

      {/* Cyber Brackets VFX overlays */}
      <div className="absolute inset-x-8 inset-y-6 pointer-events-none z-0 border border-white/[0.015] rounded-2xl">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#2dd4bf]/20 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#2dd4bf]/20 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#2dd4bf]/20 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#2dd4bf]/20 rounded-br-lg" />
      </div>

      {/* WebGL Canvas and Interactive Container */}
      <div 
        className="relative w-full h-[900px] z-10"
        onMouseMove={handleContainerMouseMove}
      >
        <Canvas 
          camera={{ position: [0, 0, 48], fov: 45 }}
          className="absolute inset-0 block w-full h-full"
        >
          <color attach="background" args={["#020503"]} />
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color="#2dd4bf" />
          <pointLight position={[-10, -10, -10]} intensity={0.8} color="#f472b6" />
          
          <Stars radius={60} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

          <SceneContent
            nodes={nodes3D}
            links={links3D}
            formation={formation}
            hoveredNode={hoveredNode}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            setHoveredNode={setHoveredNode}
            particleSize={particleSize}
            animSpeed={animSpeed}
            breathingMagnitude={breathingMagnitude}
            breathingFreq={breathingFreq}
            handWaveMagnitude={handWaveMagnitude}
            handWaveFreq={handWaveFreq}
            spinSpeed={spinSpeed}
            search={search}
            filterType={filterType}
          />

          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            minDistance={10} 
            maxDistance={100} 
          />

          <PostFXBoundary>
            <EffectComposer>
              <Bloom
                luminanceThreshold={0.15}
                luminanceSmoothing={0.8}
                intensity={2.2}
              />
            </EffectComposer>
          </PostFXBoundary>
        </Canvas>

        {/* Legend Panel Top Left */}
        <div 
          className="absolute top-6 left-12 glass-panel border border-white/10 rounded-xl p-4 bg-black/75 backdrop-blur-md shadow-2xl z-30 max-w-[200px]"
          style={{ position: "absolute" }}
        >
          <div className="text-[8px] tracking-[0.12em] uppercase text-gray-500 font-mono mb-2.5 flex items-center gap-1.5">
            <Layers size={10} className="text-[#D4A017]" />
            Node Legend
          </div>
          <div className="grid grid-cols-1 gap-2 font-mono text-[9px] text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017] flex-shrink-0" />
              <span>Projects / Core</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] flex-shrink-0" />
              <span>Skills</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7] flex-shrink-0" />
              <span>Systems</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
              <span>Areas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
              <span>Generated</span>
            </div>
          </div>
        </div>

        {/* Simulation Sliders Overlay Top Right */}
        <div 
          className="absolute top-6 right-6 glass-panel border border-white/10 rounded-xl p-4 bg-black/75 backdrop-blur-md shadow-2xl z-30 w-72"
          style={{ position: "absolute" }}
        >
          <div className="text-[9px] tracking-[0.12em] uppercase text-[#2dd4bf] font-mono mb-3 flex items-center gap-1.5">
            <Sliders size={11} className="text-[#2dd4bf] animate-pulse" />
            SWARM SIMULATION ENGINE
          </div>

          {/* Formations Grid */}
          <div className="grid grid-cols-5 gap-1 mb-4">
            {(["constellation", "sphere", "cube", "helix", "donut"] as const).map((form) => (
              <button
                key={form}
                onClick={() => setFormation(form)}
                className={`py-1 rounded text-[8px] font-bold font-mono uppercase border transition-all duration-200 ${
                  formation === form
                    ? "bg-[#2dd4bf]/20 text-[#2dd4bf] border-[#2dd4bf]/40 shadow-[0_0_8px_rgba(45,212,191,0.15)]"
                    : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white"
                }`}
              >
                {form.slice(0, 4)}
              </button>
            ))}
          </div>

          <div className="space-y-3 font-mono text-[9px]">
            {/* Particle size */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Particle Size</span>
                <span className="text-[#D4A017]">{particleSize.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.25"
                step="0.01"
                value={particleSize}
                onChange={(e) => setParticleSize(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4A017]"
              />
            </div>

            {/* Sim Speed */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Sim Speed</span>
                <span className="text-[#D4A017]">{animSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.2"
                step="0.01"
                value={animSpeed}
                onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4A017]"
              />
            </div>

            {/* Breathing */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Breathing Magnitude</span>
                <span className="text-[#D4A017]">{breathingMagnitude.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.25"
                step="0.01"
                value={breathingMagnitude}
                onChange={(e) => setBreathingMagnitude(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4A017]"
              />
            </div>

            {/* Wave Vibration */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Wave Vibration</span>
                <span className="text-[#D4A017]">{handWaveMagnitude.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={handWaveMagnitude}
                onChange={(e) => setHandWaveMagnitude(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4A017]"
              />
            </div>

            {/* Auto Spin */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Auto Spin Speed</span>
                <span className="text-[#D4A017]">{spinSpeed.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.08"
                step="0.005"
                value={spinSpeed}
                onChange={(e) => setSpinSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4A017]"
              />
            </div>
          </div>
        </div>

        {/* Floating Tooltip card */}
        {hoveredNode && tooltipPos && (
          <div
            className="absolute pointer-events-none z-50 bg-black/95 border border-white/10 rounded-xl p-3 backdrop-blur-md shadow-2xl font-mono text-[9px] w-60 transition-all duration-75"
            style={{
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 48,
              borderColor: `${hoveredNode.color}75`,
              boxShadow: `0 8px 30px rgba(0,0,0,0.95), inset 0 0 10px ${hoveredNode.color}15`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: hoveredNode.color, boxShadow: `0 0 8px ${hoveredNode.color}` }} />
              <span className="text-white font-bold tracking-wider uppercase text-[10px] truncate">{hoveredNode.name}</span>
            </div>
            <div className="text-gray-500 capitalize mb-0.5">
              Type: <span style={{ color: hoveredNode.color }}>{hoveredNode.type}</span>
            </div>
            {hoveredNode.path && (
              <div className="text-gray-600 truncate mb-0.5">
                Path: {hoveredNode.path}
              </div>
            )}
            {hoveredNode.description && (
              <div className="text-gray-300 leading-normal border-t border-white/5 pt-1 mt-1">
                {hoveredNode.description}
              </div>
            )}
            <div className="text-[7px] text-gray-600 mt-1 uppercase tracking-wider">Click to select core node</div>
          </div>
        )}

        {/* Stats and Signal overlay panels stacked bottom-left/right inside viewport */}
        <div className="absolute bottom-6 left-12 flex gap-3.5 z-30 font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-[10px] backdrop-blur-md">
            <span className="font-bold text-white mr-1">{stats.nodes}</span>
            <span className="text-gray-500">Nodes</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-[10px] backdrop-blur-md">
            <span className="font-bold text-[#60a5fa] mr-1">{stats.repos}</span>
            <span className="text-gray-500">Repos</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-[10px] backdrop-blur-md">
            <span className="font-bold text-[#2dd4bf] mr-1">{stats.files}</span>
            <span className="text-gray-500">Docs</span>
          </div>
        </div>

        {/* Formations and Filter pills inside center bottom of screen */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-2xl z-30 overflow-x-auto max-w-[90vw] no-scrollbar">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "all" ? "bg-white/12 text-white border border-white/20" : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("projects")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "projects" ? "bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40" : "text-gray-400 hover:text-[#a855f7]/90 border border-transparent"
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setFilterType("skills")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "skills" ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40" : "text-gray-400 hover:text-[#22c55e]/90 border border-transparent"
            }`}
          >
            Skills
          </button>
          <button
            onClick={() => setFilterType("systems")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "systems" ? "bg-[#0ea5e9]/20 text-[#0ea5e9] border border-[#0ea5e9]/40" : "text-gray-400 hover:text-[#0ea5e9]/90 border border-transparent"
            }`}
          >
            Systems
          </button>
          <button
            onClick={() => setFilterType("areas")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "areas" ? "bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40" : "text-gray-400 hover:text-[#f59e0b]/90 border border-transparent"
            }`}
          >
            Areas
          </button>
          <button
            onClick={() => setFilterType("generated")}
            className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all duration-200 ${
              filterType === "generated" ? "bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40" : "text-gray-400 hover:text-[#ef4444]/90 border border-transparent"
            }`}
          >
            Generated
          </button>
        </div>
      </div>

      {/* Vault Control Card Stack and Detailed Panel */}
      <div className="relative flex-shrink-0 z-20 border-t border-white/10 bg-[#020503]/95 backdrop-blur-lg px-6 py-5 max-h-[380px] overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full">
          
          {/* Dashboard launchers header */}
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-3">
              <Database size={16} className="text-[#D4A017] drop-shadow-[0_0_8px_#D4A017]" />
              <div>
                <h2 className="text-xs font-bold tracking-wide font-mono text-white uppercase">Vault Control Center</h2>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5">Obsidian Sync · Cloned Repositories · Systems Indexes</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Interactive filtering search bar */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter constellation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-black/40 border border-white/10 pl-8 pr-3 py-1.5 rounded-lg text-[10px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors w-44"
                />
              </div>

              <a
                href="obsidian://open?vault=Obsidian%20Vault&file=Hermes%20OS/07%20Reference/Cloned%20Repos/README"
                className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-white transition-colors bg-emerald-400/10 border border-emerald-400/30 px-3 py-1.5 rounded-lg hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] font-mono"
              >
                <BookOpen size={11} />
                Open Obsidian
              </a>
            </div>
          </div>

          {/* Active Detail Display */}
          {selectedNode ? (
            <ParallaxTiltCard className="w-full">
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(12,14,24,0.9) 0%, rgba(6,7,12,0.9) 100%)",
                  border: `1px solid ${selectedNode.color}50`,
                  boxShadow: `0 0 35px ${selectedNode.color}20`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg border"
                      style={{ 
                        backgroundColor: `${selectedNode.color}15`, 
                        borderColor: `${selectedNode.color}30`,
                        boxShadow: `0 0 15px ${selectedNode.color}15`
                      }}
                    >
                      {selectedNode.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm font-mono">{selectedNode.name}</span>
                        <span 
                          className="px-2 py-0.5 rounded text-[7px] uppercase font-bold tracking-widest font-mono border"
                          style={{ 
                            color: selectedNode.color, 
                            borderColor: `${selectedNode.color}30`,
                            backgroundColor: `${selectedNode.color}10` 
                          }}
                        >
                          {selectedNode.type}
                        </span>
                      </div>
                      <div className="text-[8px] font-mono text-gray-500 mt-0.5">
                        ID: {selectedNode.id}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedNode(null)} 
                    className="text-gray-500 hover:text-white text-lg font-bold transition-colors px-1"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-black/50 rounded-xl p-3 border border-white/[0.04]">
                    <div className="text-[8px] uppercase tracking-widest font-mono mb-1.5 font-bold" style={{ color: selectedNode.color }}>Node Description</div>
                    <div className="text-[10px] text-gray-300 font-mono leading-relaxed">{selectedNode.description}</div>
                  </div>
                  
                  <div className="bg-black/50 rounded-xl p-3 border border-white/[0.04]">
                    <div className="text-[8px] uppercase tracking-widest font-mono mb-1.5 text-violet-400 font-bold">Network Connections</div>
                    <div className="text-[9px] text-gray-400 font-mono space-y-1.5 max-h-[80px] overflow-y-auto custom-scrollbar pr-1">
                      {(() => {
                        const connections = links3D.filter(l => l.source === selectedNode.id || l.target === selectedNode.id);
                        if (connections.length === 0) {
                          return <div className="text-[9px] text-gray-600 italic">No custom connections. Connected to Hermes Core.</div>;
                        }
                        return connections.map((conn, idx) => {
                          const neighborId = conn.source === selectedNode.id ? conn.target : conn.source;
                          const neighbor = nodes3D.find(n => n.id === neighborId);
                          if (!neighbor) return null;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedNode(neighbor);
                              }}
                              className="flex items-center gap-1 hover:text-white transition-colors text-left w-full truncate"
                            >
                              <span style={{ color: neighbor.color }}>•</span>
                              <span className="text-gray-400 hover:underline">{neighbor.name}</span>
                              <span className="text-[7px] text-gray-600">({neighbor.type})</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  
                  <div className="bg-black/50 rounded-xl p-3 border border-white/[0.04]">
                    <div className="text-[8px] uppercase tracking-widest font-mono mb-1.5 text-[#D4A017] font-bold">Obsidian Knowledge Base</div>
                    {(() => {
                      // Resolve Obsidian path
                      const queryName = selectedNode.name.toLowerCase();
                      let resolvedFile: any = null;
                      for (const section of data.vault) {
                        for (const file of section.files) {
                          const baseName = file.name.replace(/\.md$/, "").toLowerCase();
                          if (baseName === queryName || file.name.toLowerCase() === queryName || file.path.toLowerCase().includes(queryName)) {
                            resolvedFile = { section: section.section, name: file.name };
                            break;
                          }
                        }
                        if (resolvedFile) break;
                      }

                      const obsidianLink = resolvedFile 
                        ? `obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent("Hermes OS/" + resolvedFile.section + "/" + resolvedFile.name)}`
                        : `obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent("Hermes OS/" + (selectedNode.type === "projects" ? "01 - PROJECTS" : selectedNode.type === "skills" ? "02 - SKILLS" : selectedNode.type === "systems" ? "03 - SYSTEM" : selectedNode.type === "areas" ? "04 - AREAS" : "03 - SYSTEM") + "/" + selectedNode.name + ".md")}`;

                      return (
                        <div>
                          <a
                            href={obsidianLink}
                            className="text-[10px] font-mono flex items-center gap-1.5 hover:text-white transition-all duration-200 mt-1 animate-pulse"
                            style={{ color: "#D4A017" }}
                          >
                            <BookOpen size={11} />
                            Launch obsidian:// deep-link
                            <ExternalLink size={9} />
                          </a>
                          <p className="text-[8px] text-gray-500 mt-2 font-mono leading-snug">Opens reference page "{selectedNode.name}.md" directly in your Obsidian application.</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </ParallaxTiltCard>
          ) : (
            <div>
              {/* Default Grid: display Constellation Dashboard grouped by taxonomy */}
              <div className="text-[9px] tracking-[0.15em] uppercase text-gray-500 font-mono mb-3 flex items-center justify-between">
                <span>Knowledge Base Constellation Index</span>
                <span className="text-[8px] text-gray-600">{constellationData.nodes ? constellationData.nodes.length : 0} registered nodes</span>
              </div>
              {loading ? (
                <div className="text-xs text-gray-500 font-mono animate-pulse">Mapping stellar nodes...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {(["projects", "skills", "systems", "areas", "generated"] as const).map((groupName) => {
                    const groupNodes = nodes3D.filter(n => n.type === groupName);
                    if (groupNodes.length === 0) return null;
                    
                    // Hermes palette: gold = projects (primary), emerald = skills (connected/live),
                    // violet = systems (creative/structural). Areas + generated are tinted neutrals
                    // so the eye reads them as "supporting" not "primary categories".
                    const groupColor = groupName === "projects" ? "#D4A017" :
                                       groupName === "skills" ? "#10b981" :
                                       groupName === "systems" ? "#a855f7" :
                                       groupName === "areas" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)";
                    
                    return (
                      <div key={groupName} className="bg-black/30 rounded-xl p-3 border border-white/[0.04] flex flex-col min-h-[140px]">
                        <div className="text-[8px] uppercase tracking-widest font-mono mb-2 font-bold flex items-center gap-1.5" style={{ color: groupColor }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: groupColor }} />
                          {groupName}
                          <span className="ml-auto text-[8px] text-gray-600">({groupNodes.length})</span>
                        </div>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar flex-1">
                          {groupNodes.map(node => (
                            <button
                              key={node.id}
                              onClick={() => setSelectedNode(node)}
                              className="w-full text-left p-1.5 rounded border border-white/[0.03] bg-black/40 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-150 group"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{node.icon}</span>
                                <span className="text-[9px] font-medium font-mono text-gray-300 group-hover:text-white truncate">{node.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Obsidian Vault directory folder browser */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="text-[9px] tracking-[0.15em] uppercase text-gray-500 font-mono mb-3">
              Obsidian Vault Folders
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {data.vault.map(section => {
                const sectionColor = section.section.includes("SYSTEM") ? "#f472b6" :
                                     section.section.includes("DECISIONS") ? "#60a5fa" :
                                     section.section.includes("WORKSPACE") ? "#818cf8" : "#7c3aed";
                return (
                  <div
                    key={section.section}
                    className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Folder size={11} style={{ color: sectionColor }} />
                      <span className="text-[9px] font-bold font-mono text-white truncate">{section.section}</span>
                      <span className="ml-auto text-[8px] font-mono text-gray-600">{section.files.length} files</span>
                    </div>
                    <div className="space-y-1.5">
                      {section.files.slice(0, 3).map(f => (
                        <a
                          key={f.path}
                          href={`obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent("Hermes OS/" + section.section + "/" + f.name)}`}
                          className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 hover:text-[#2dd4bf] transition-colors truncate"
                        >
                          <GitBranch size={8} className="text-gray-600 flex-shrink-0" />
                          {f.name}
                        </a>
                      ))}
                      {section.files.length > 3 && (
                        <div className="text-[8px] font-mono text-gray-600 pl-3">
                          +{section.files.length - 3} more files
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Studio Outputs ── */}
          <StudioPanel />

        </div>
      </div>
    </div>
  );
}
