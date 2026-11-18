import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Center } from '@react-three/drei';
import * as THREE from 'three';

const GoatModel = ({ scale = 1 }: { scale?: number }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Медленно вращаем голову по кругу
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  const goldMat = <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.15} emissive="#ffa500" emissiveIntensity={0.2} />;
  const darkMat = <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />;
  const eyeMat = <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={5} toneMapped={false} />;

  return (
    <group ref={groupRef} scale={scale}>
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

      {/* Левый глаз (светится) */}
      <mesh position={[-0.25, 0.1, 0.55]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {eyeMat}
      </mesh>

      {/* Правый глаз (светится) */}
      <mesh position={[0.25, 0.1, 0.55]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {eyeMat}
      </mesh>

      {/* Золотая борода */}
      <mesh position={[0, -1.1, 0.4]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.2, 0.6, 4]} />
        {goldMat}
      </mesh>
    </group>
  );
};

export const Goat3D = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 820;
  const size = isMobile ? 90 : 140;
  return (
    <div style={{ width: size, height: size, margin: '0 auto', cursor: 'grab' }}>
      <Canvas camera={{ position: [0, 0, 4.5], fov: isMobile ? 60 : 50 }}>
        <ambientLight intensity={1.5} />
        {/* Свет, чтобы золото переливалось */}
        <directionalLight position={[5, 5, 5]} intensity={3} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={2} color="#f0c674" />
        <pointLight position={[0, -2, 2]} intensity={2} color="#ffd700" />

        <Float speed={2} rotationIntensity={0.4} floatIntensity={2}>
          <Center>
            <GoatModel scale={isMobile ? 0.8 : 1} />
          </Center>
        </Float>
      </Canvas>
    </div>
  );
};