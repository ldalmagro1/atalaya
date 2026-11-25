/**
 * Proceso auxiliar de `core-migrations.test.ts`: avisa que está listo, espera la señal por stdin
 * y recién entonces abre la base y migra, para que varios procesos compitan de verdad.
 */
import { runCoreMigrations } from './core-migrations.js';
import { openDatabase } from './open.js';

const path = process.argv[2];
if (!path) throw new Error('Falta la ruta de la base');

process.stdin.once('data', () => {
  const db = openDatabase({ path });
  const applied = runCoreMigrations(db);
  db.close();
  process.stdout.write(`applied ${JSON.stringify(applied)}\n`, () => process.exit(0));
});
process.stdout.write('ready\n');
