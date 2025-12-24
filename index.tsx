import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  PerspectiveCamera, 
  Stars, 
  Float, 
  Sparkles 
} from '@react-three/drei';

// --- CONSTANTS ---

const TreeState = {
  TREE_SHAPE: 'TREE_SHAPE',
  SCATTERED: 'SCATTERED',
  TRANSITIONING: 'TRANSITIONING'
};

const GestureType = {
  FIST_CLENCH: 'FIST_CLENCH',
  OPEN_PALM: 'OPEN_PALM',
  GRABBING: 'GRABBING',
  NONE: 'NONE'
};

// --- SERVICES ---

const hapticFeedback = {
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  },
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 10, 30]);
    }
  },
  heavy: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 80]);
    }
  }
};

// --- BACKGROUND COMPONENTS ---

const Nebula = () => {
  const nebulae = useMemo(() => [
    { color: '#1a0b3d', pos: [-15, 5, -20] },
    { color: '#0b1d3d', pos: [15, -10, -25] },
    { color: '#2d0b3d', pos: [0, 15, -30] },
  ], []);

  return (
    <group>
      {nebulae.map((n, i) => (
        <mesh key={i} position={n.pos as any}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color={n.color} transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
          <pointLight color={n.color} intensity={2} distance={50} />
        </mesh>
      ))}
    </group>
  );
};

const CosmicDust = () => {
  const pointsRef = useRef<THREE.Points>(null!);
  const DUST_COUNT = 5000;
  const BOUNDS = 30;

  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    const vel = new Float32Array(DUST_COUNT * 3);
    const cols = new Float32Array(DUST_COUNT * 3);
    const palette = [new THREE.Color('#4466ff'), new THREE.Color('#ff44aa'), new THREE.Color('#ffffff')];

    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * BOUNDS * 2.5;
      pos[i3 + 1] = (Math.random() - 0.5) * BOUNDS * 2.5;
      pos[i3 + 2] = (Math.random() - 0.5) * BOUNDS * 2.5;
      vel[i3] = (Math.random() - 0.5) * 0.01;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.01;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.01;
      const color = palette[Math.floor(Math.random() * palette.length)];
      cols[i3] = color.r; cols[i3+1] = color.g; cols[i3+2] = color.b;
    }
    return [pos, vel, cols];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] += velocities[i3] + Math.sin(time * 0.2 + i) * 0.001;
      pos[i3+1] += velocities[i3+1] + Math.cos(time * 0.2 + i) * 0.001;
      pos[i3+2] += velocities[i3+2] + Math.sin(time * 0.5 + i) * 0.001;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={DUST_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={DUST_COUNT} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation={true} />
    </points>
  );
};

const MilkyWay = () => {
  const groupRef = useRef<THREE.Group>(null!);
  const STAR_COUNT = 8000;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const cols = new Float32Array(STAR_COUNT * 3);
    const palette = [new THREE.Color('#fff4e6'), new THREE.Color('#ffffff'), new THREE.Color('#e6f0ff')];

    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3;
      const u = (Math.random() - 0.5) * 80;
      const v = (Math.random() - 0.5) * (Math.random() - 0.5) * 20;
      const w = (Math.random() - 0.5) * (Math.random() - 0.5) * 10;
      pos[i3] = u; pos[i3+1] = v; pos[i3+2] = w - 40;
      const color = palette[Math.floor(Math.random() * palette.length)];
      cols[i3] = color.r; cols[i3+1] = color.g; cols[i3+2] = color.b;
    }
    return [pos, cols];
  }, []);

  useFrame(() => { if (groupRef.current) groupRef.current.rotation.z += 0.0001; });

  return (
    <group ref={groupRef} rotation={[0.4, 0.5, 0.8]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={STAR_COUNT} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={STAR_COUNT} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.05} vertexColors transparent opacity={0.6} sizeAttenuation={true} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
};

// --- TREE COMPONENTS ---

const TreeParticles = ({ state }: { state: string }) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const PARTICLE_COUNT = 8000;

  const positions = useMemo(() => {
    const tree = new Float32Array(PARTICLE_COUNT * 3);
    const scattered = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const ratio = i / PARTICLE_COUNT;
      const angle = ratio * Math.PI * 40;
      const radius = (1 - ratio) * 2.5;
      const height = ratio * 7 - 3.5;

      tree[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.1;
      tree[i3+1] = height;
      tree[i3+2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.1;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 5;
      scattered[i3] = r * Math.sin(phi) * Math.cos(theta);
      scattered[i3+1] = r * Math.sin(phi) * Math.sin(theta);
      scattered[i3+2] = r * Math.cos(phi);

      const isRed = Math.random() > 0.8;
      if (isRed) { colors[i3] = 0.8; colors[i3+1] = 0.1; colors[i3+2] = 0.1; }
      else { colors[i3] = 0.95; colors[i3+1] = 0.8; colors[i3+2] = 0.3; }
    }
    return { tree, scattered, colors };
  }, []);

  const currentPos = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  useEffect(() => {
    const initial = state === TreeState.TREE_SHAPE ? positions.tree : positions.scattered;
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) currentPos[i] = initial[i];
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const target = state === TreeState.TREE_SHAPE ? positions.tree : positions.scattered;
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
      currentPos[i] = THREE.MathUtils.lerp(currentPos[i], target[i], 0.05);
      currentPos[i] += (Math.random() - 0.5) * 0.005;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={currentPos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={PARTICLE_COUNT} array={positions.colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} vertexColors transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

const TreeStar = ({ state }: { state: string }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const isTree = state === TreeState.TREE_SHAPE;

  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? 0.5 : 0.22;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: 0.15, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 3 });
    geometry.center(); return geometry;
  }, []);

  useFrame((stateObj, delta) => {
    if (!meshRef.current) return;
    const time = stateObj.clock.getElapsedTime();
    const s = THREE.MathUtils.lerp(meshRef.current.scale.x, isTree ? 1 : 0, 0.1);
    meshRef.current.scale.set(s, s, s);
    meshRef.current.rotation.y += delta * 1.2;
    meshRef.current.rotation.z = Math.PI;

    const twinkle = Math.sin(time * 3) * 0.5 + Math.sin(time * 7) * 0.2 + 1;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, (isTree ? 3 : 0) * twinkle, 0.1);
    
    if (lightRef.current) lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, isTree ? 4 + Math.sin(time * 5) * 1 : 0, 0.1);
  });

  return (
    <group position={[0, 3.8, 0]}>
      <mesh ref={meshRef} geometry={starGeometry}>
        <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={3} metalness={1} roughness={0.1} transparent />
      </mesh>
      <pointLight ref={lightRef} color="#ffd700" intensity={4} distance={6} />
    </group>
  );
};

const TreeDecorations = ({ state }: { state: string }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const DECORATION_COUNT = 40;

  const decorations = useMemo(() => {
    const items = [];
    for (let i = 0; i < DECORATION_COUNT; i++) {
      const ratio = i / DECORATION_COUNT;
      const angle = ratio * Math.PI * 12; 
      const radius = (1 - ratio) * 2.7; 
      const height = ratio * 6.8 - 3.4;
      const color = Math.random() > 0.5 ? '#FFD700' : '#E5E4E2';
      items.push({ position: [Math.cos(angle)*radius, height, Math.sin(angle)*radius] as [number, number, number], color, size: 0.08 + Math.random() * 0.1 });
    }
    return items;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetScale = state === TreeState.TREE_SHAPE ? 1 : 0;
    groupRef.current.children.forEach(c => {
      c.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
    });
  });

  return (
    <group ref={groupRef}>
      {decorations.map((d, i) => (
        <mesh key={i} position={d.position}>
          <sphereGeometry args={[d.size, 16, 16]} />
          <meshStandardMaterial color={d.color} metalness={0.9} roughness={0.1} emissive={d.color} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
};

// --- GROUND COMPONENTS ---

const HeavyGroundSnow = () => {
  const pointsRef = useRef<THREE.Points>(null!);
  const SNOW_COUNT = 400; const BOUNDS_RADIUS = 8; const GROUND_Y = -4.9;
  const [positions, data] = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3); const meta = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * BOUNDS_RADIUS;
      pos[i3] = Math.cos(angle) * radius; pos[i3+1] = Math.random() * 10 - 5; pos[i3+2] = Math.sin(angle) * radius;
      meta[i3] = 0.005 + Math.random() * 0.01; meta[i3+1] = 0.5 + Math.random() * 1.5; meta[i3+2] = 0.1 + Math.random() * 0.2;
    }
    return [pos, meta];
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posArr = pointsRef.current.geometry.attributes.position.array as Float32Array; 
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3; posArr[i3+1] -= data[i3] * delta * 60;
      posArr[i3] += Math.sin(time * data[i3+1] + i) * data[i3+2] * 0.01;
      if (posArr[i3+1] < GROUND_Y) { posArr[i3+1] = 5; }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={SNOW_COUNT} array={positions} itemSize={3} /></bufferGeometry>
      <pointsMaterial size={0.12} color="#ffffff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation={true} />
    </points>
  );
};

const GroundObjects = () => {
  const GIFT_COUNT = 24;
  const gifts = useMemo(() => {
    const items = [];
    const REDS = ['#b71c1c', '#d32f2f', '#880e4f', '#c62828'];
    const GREENS = ['#1b5e20', '#2e7d32', '#004d40', '#388e3c'];
    const RIBBONS = ['#ffd700', '#e5e4e2', '#ffffff'];
    for (let i = 0; i < GIFT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2; const radius = 0.7 + Math.pow(Math.random(), 1.4) * 3.2;
      let w, h, d; const r = Math.random();
      if (r < 0.4) { w = h = d = 0.3 + Math.random() * 0.4; } 
      else if (r < 0.7) { w = d = 0.3 + Math.random()*0.3; h = w * (1.2 + Math.random()*1.0); } 
      else { w = 0.5 + Math.random()*0.4; d = 0.4 + Math.random()*0.4; h = 0.2 + Math.random()*0.3; }
      const colors = Math.random() > 0.5 ? REDS : GREENS;
      items.push({ pos: [Math.cos(angle)*radius, -4.9 + h/2, Math.sin(angle)*radius] as [number, number, number], rot: [0, Math.random()*Math.PI, 0] as [number, number, number], scale: [w,h,d] as [number, number, number], color: colors[Math.floor(Math.random()*colors.length)], rib: RIBBONS[Math.floor(Math.random()*RIBBONS.length)] });
    }
    return items;
  }, []);

  return (
    <group>
      {gifts.map((g, i) => (
        <group key={i} position={g.pos} rotation={g.rot} scale={g.scale}>
          <mesh castShadow><boxGeometry args={[1,1,1]} /><meshStandardMaterial color={g.color} roughness={0.15} metalness={0.7} emissive={g.color} emissiveIntensity={0.03} /></mesh>
          <mesh position={[0, 0, 0]} scale={[1.05, 0.1, 1.05]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color={g.rib} metalness={1} roughness={0.1} /></mesh>
          <mesh position={[0, 0, 0]} scale={[0.1, 1.05, 1.05]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color={g.rib} metalness={1} roughness={0.1} /></mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow><circleGeometry args={[20, 64]} /><meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.1} emissive="#e3f2fd" emissiveIntensity={0.03} /></mesh>
    </group>
  );
};

// --- SCENE & APP ---

const Scene = ({ treeState }: { treeState: string }) => (
  <div className="w-full h-full bg-[#020205]">
    <Canvas dpr={[1, 2]} gl={{ antialias: true }} shadows>
      <PerspectiveCamera makeDefault position={[0, 1, 12]} fov={45} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={25} autoRotate autoRotateSpeed={0.3} />
      <Suspense fallback={null}>
        <Environment preset="night" />
        <Stars radius={150} depth={50} count={5000} factor={4} saturation={1} fade speed={0.5} />
        <Nebula /> <CosmicDust /> <MilkyWay />
        <Sparkles count={50} scale={15} size={2} speed={0.2} opacity={0.3} color="#ffffff" />
        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
          <TreeParticles state={treeState} />
          <TreeDecorations state={treeState} />
          <TreeStar state={treeState} />
        </Float>
        <GroundObjects />
        <HeavyGroundSnow />
        <pointLight position={[0, 5, 0]} intensity={1.5} color="#4466ff" />
        <pointLight position={[-5, 2, 5]} intensity={0.8} color="#ff44aa" castShadow />
        <ambientLight intensity={0.2} />
      </Suspense>
    </Canvas>
  </div>
);

const App = () => {
  const [treeState, setTreeState] = useState(TreeState.TREE_SHAPE);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleGesture = useCallback((gesture: string) => {
    if (isTransitioning) return;
    if (gesture === GestureType.FIST_CLENCH && treeState !== TreeState.SCATTERED) {
      setTreeState(TreeState.SCATTERED); hapticFeedback.heavy(); triggerLock();
    } else if (gesture === GestureType.OPEN_PALM && treeState !== TreeState.TREE_SHAPE) {
      setTreeState(TreeState.TREE_SHAPE); hapticFeedback.medium(); triggerLock();
    } else if (gesture === GestureType.GRABBING) {
      hapticFeedback.light();
    }
  }, [treeState, isTransitioning]);

  const triggerLock = () => { setIsTransitioning(true); setTimeout(() => setIsTransitioning(false), 2000); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f') handleGesture(GestureType.FIST_CLENCH);
      if (e.key === 'o') handleGesture(GestureType.OPEN_PALM);
      if (e.key === 'g') handleGesture(GestureType.GRABBING);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGesture]);

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white select-none bg-black">
      <Scene treeState={treeState} />
      
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-12 z-10">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-light tracking-[0.3em] uppercase">Arix</h1>
            <p className="text-[10px] text-amber-500/80 tracking-[0.4em] uppercase mt-2">Signature Interactive Series</p>
          </div>
        </header>

        <footer className="flex flex-col items-center gap-10 pointer-events-auto mb-4">
          <div className="flex flex-col items-center gap-4">
            <span className="text-[9px] text-gray-500 uppercase tracking-[0.5em]">Command Input</span>
            <div className="flex gap-6 p-3 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10 shadow-2xl">
              <button 
                onClick={() => handleGesture(GestureType.OPEN_PALM)} 
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${treeState === TreeState.TREE_SHAPE ? 'bg-amber-500 text-black scale-110 shadow-[0_0_30px_rgba(245,158,11,0.6)]' : 'bg-white/5 text-white hover:bg-white/10'}`}
                title="Form Tree (Press 'O')"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              </button>
              <button 
                onClick={() => handleGesture(GestureType.FIST_CLENCH)} 
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${treeState === TreeState.SCATTERED ? 'bg-amber-500 text-black scale-110 shadow-[0_0_30px_rgba(245,158,11,0.6)]' : 'bg-white/5 text-white hover:bg-white/10'}`}
                title="Scatter (Press 'F')"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/><path d="M11 7.5V3a1.5 1.5 0 0 0-3 0v4.5"/><path d="M15 8V4a1.5 1.5 0 0 0-3 0v4"/><path d="M19 10V6a1.5 1.5 0 0 0-3 0v4"/></svg>
              </button>
            </div>
          </div>
          <div className="text-center opacity-30"><p className="text-[9px] tracking-[0.6em] uppercase">Tactile Haptic Sync Active</p></div>
        </footer>
      </div>

      {/* Decorative Gradients */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)] z-0" />
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);