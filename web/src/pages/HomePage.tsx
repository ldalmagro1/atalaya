import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBox } from '../components/ErrorBox';
import { HealthBanner } from '../components/HealthBanner';
import { MarkdownView } from '../components/MarkdownView';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { Tabs } from '../components/Tabs';

const SAMPLE_MARKDOWN = `Texto con **negrita**, \`código\` y un [enlace](https://example.com).

| Severidad | Estado |
| --------- | ------ |
| crítica   | abierta |

- Elemento de lista
- ~~Tachado~~ con GFM

<script>alert('esto se muestra como texto')</script>
`;

export function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <HealthBanner />

      <section className="space-y-2">
        <h1>Atalaya</h1>
        <p className="text-text-600">
          Base de la interfaz: tema claro y oscuro, tipografía y componentes comunes.
        </p>
      </section>

      <Card className="space-y-3">
        <h2>Botones</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="danger">Peligro</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Deshabilitado
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2>Insignias</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="critical">Crítico</Badge>
          <Badge variant="major">Mayor</Badge>
          <Badge variant="minor">Menor</Badge>
          <Badge variant="nit">Detalle</Badge>
          <Badge variant="success">Éxito</Badge>
          <Badge variant="error">Error</Badge>
          <Badge>Neutral</Badge>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2>Estados</h2>
        <Spinner />
        <ErrorBox title="Error de ejemplo">Así se ve un error de la interfaz.</ErrorBox>
        <p>
          Texto secundario: <span className="text-text-600">menos énfasis</span>. Un{' '}
          <a href="#enlace" className="text-accent-600 hover:text-accent-700">
            enlace
          </a>{' '}
          y código en línea: <code className="font-mono text-sm">npm run dev</code>.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2>Pestañas y modal</h2>
        <Tabs
          tabs={[
            { id: 'uno', label: 'Primera', content: <p>Contenido de la primera pestaña.</p> },
            { id: 'dos', label: 'Segunda', content: <p>Contenido de la segunda pestaña.</p> },
          ]}
        />
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Abrir modal
        </Button>
        <Modal open={modalOpen} title="Modal de ejemplo" onClose={() => setModalOpen(false)}>
          <p className="mb-4">Se cierra con Escape, con la X o al hacer click fuera.</p>
          <Button onClick={() => setModalOpen(false)}>Entendido</Button>
        </Modal>
      </Card>

      <Card className="space-y-3">
        <h2>Markdown</h2>
        <MarkdownView>{SAMPLE_MARKDOWN}</MarkdownView>
      </Card>
    </>
  );
}
