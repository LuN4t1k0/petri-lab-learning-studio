import { cp, mkdir, rm } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await rm('dist/assets', { recursive: true, force: true });
await cp('src', 'dist/assets', { recursive: true });

console.log('PetriLab listo en dist/');
