import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

const GoatModel = ({ celebrate, reducedMotion }: { celebrate: boolean; reducedMotion: boolean }) => {
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!head.current || !eyes.current) return;
    if (reducedMotion) {
      head.current.rotation.set(0, 0, 0);
      head.current.position.y = 0;
      eyes.current.scale.y = 1;
      return;
    }

    elapsed.current += Math.min(delta, 0.05);
    const time = elapsed.current;
    const blink = (time + 2) % 5.3;
    eyes.current.scale.y = blink < 0.18 ? 1 - 0.95 * Math.sin(Math.PI * blink / 0.18) : 1;

    if (celebrate) {
      const progress = Math.min(1, time / 1.6);
      const bounce = Math.sin(Math.PI * progress) ** 2;
      head.current.position.y = 0.3 * bounce * Math.abs(Math.sin(2 * Math.PI * progress));
      head.current.rotation.z = 0.26 * bounce * Math.sin(4 * Math.PI * progress);
      return;
    }

    const nod = time % 7;
    head.current.rotation.x = nod > 5.6 ? 0.21 * Math.sin(Math.PI * (nod - 5.6) / 1.4) ** 2 : 0;
    head.current.rotation.y = 0.13 * Math.sin(time * 0.75);
  });

  const goldMat = <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.15} emissive="#ffa500" emissiveIntensity={0.2} />;
  const darkMat = <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />;
  const eyeMat = <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={5} toneMapped={false} />;

  return (
    <group ref={head}>
      {/* Основа черепа (темный металл) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1.2, 0.8]} />
        {darkMat}
      </mesh>
      
      {/* Золотая лицевая пластина */}
      <mesh position={[0, -0.1, 0.45]}>
        <boxGeometry args={[0.9, 0.9, 0.2]} />
        {goldMat}
      </mesh>

      {/* Золотая морда */}
      <mesh position={[0, -0.7, 0.5]}>
        <boxGeometry args={[0.6, 0.5, 0.4]} />
        {goldMat}
      </mesh>

      {/* Левый рог */}
      <mesh position={[-0.5, 0.7, -0.1]} rotation={[0, 0, -Math.PI / 3]}>
        <coneGeometry args={[0.15, 1.2, 8]} />
        {goldMat}
      </mesh>
      
      {/* Правый рог */}
      <mesh position={[0.5, 0.7, -0.1]} rotation={[0, 0, Math.PI / 3]}>
        <coneGeometry args={[0.15, 1.2, 8]} />
        {goldMat}
      </mesh>

      <group ref={eyes} position={[0, 0.1, 0.55]}>
        <mesh position={[-0.25, 0, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          {eyeMat}
        </mesh>
        <mesh position={[0.25, 0, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          {eyeMat}
        </mesh>
      </group>

      {/* Золотая борода */}
      <mesh position={[0, -1.1, 0.4]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.2, 0.6, 4]} />
        {goldMat}
      </mesh>
    </group>
  );
};

export const Goat3D = ({ celebrate = false }: { celebrate?: boolean }) => {
  const reducedMotion = Boolean(useReducedMotion());
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 820;
  const size = celebrate ? 80 : isMobile ? 90 : 140;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, margin: '0 auto' }}>
      <Canvas camera={{ position: [0, 0, 4.5], fov: isMobile ? 60 : 50 }}>
        <ambientLight intensity={1.5} />
        {/* Свет, чтобы золото переливалось */}
        <directionalLight position={[5, 5, 5]} intensity={3} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={2} color="#f0c674" />
        <pointLight position={[0, -2, 2]} intensity={2} color="#ffd700" />

        <Center scale={isMobile ? 0.8 : 1}>
          <GoatModel celebrate={celebrate} reducedMotion={reducedMotion} />
        </Center>
      </Canvas>
    </div>
  );
};