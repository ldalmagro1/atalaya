// Lista los enlaces (symlinks y junctions) de una carpeta que apuntan fuera de ella.
// Lo usa /iniciar-US antes de borrar un worktree: en Windows, `git worktree remove`
// sigue las junctions y borra el contenido del destino.
// Uso: node scripts/enlaces-externos.mjs <carpeta>
// Código de salida: 0 sin enlaces externos, 1 si hay alguno, 2 si no pudo revisar.
import { readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

function esExterno(raiz, destino) {
  const ruta = relative(raiz, destino);
  return ruta === '..' || ruta.startsWith(`..${sep}`) || isAbsolute(ruta);
}

function buscar(raiz, carpeta, hallados) {
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isSymbolicLink()) {
      let destino;
      try {
        destino = realpathSync.native(ruta);
      } catch {
        // Enlace roto: se evalúa la ruta a la que apunta.
        destino = resolve(carpeta, readlinkSync(ruta));
      }
      if (esExterno(raiz, destino)) hallados.push(`${ruta} -> ${destino}`);
    } else if (entrada.isDirectory()) {
      buscar(raiz, ruta, hallados);
    }
  }
  return hallados;
}

try {
  const argumento = process.argv[2];
  if (!argumento) throw new Error('falta la carpeta a revisar');
  const raiz = realpathSync.native(argumento);
  const hallados = buscar(raiz, raiz, []);
  for (const hallado of hallados) console.log(hallado);
  process.exitCode = hallados.length > 0 ? 1 : 0;
} catch (error) {
  console.error(`No se pudo revisar: ${error.message}`);
  process.exitCode = 2;
}
