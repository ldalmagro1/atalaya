import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** react-markdown pasa `node` a cada componente; no debe llegar al DOM como atributo. */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

/**
 * Renderiza Markdown como contenido no confiable: sin `rehype-raw`, el HTML crudo se muestra
 * como texto y nunca se interpreta. Los enlaces se abren sin `opener` ni `referrer`.
 */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="space-y-3 break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...withoutNode(props)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-600 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500"
            />
          ),
          code: (props) => {
            const { className = '', ...rest } = withoutNode(props);
            return <code className={`font-mono text-sm ${className}`} {...rest} />;
          },
          // El preflight de Tailwind quita viñetas, numeración y bordes: se restituyen.
          ul: (props) => <ul {...withoutNode(props)} className="list-disc space-y-1 pl-6" />,
          ol: (props) => <ol {...withoutNode(props)} className="list-decimal space-y-1 pl-6" />,
          blockquote: (props) => (
            <blockquote
              {...withoutNode(props)}
              className="border-l-4 border-background-300 pl-4 text-text-600"
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto">
              <table {...withoutNode(props)} className="w-full border-collapse text-left" />
            </div>
          ),
          th: (props) => (
            <th
              {...withoutNode(props)}
              className="border border-background-300 bg-background-200 px-3 py-2 font-bold"
            />
          ),
          td: (props) => (
            <td {...withoutNode(props)} className="border border-background-300 px-3 py-2" />
          ),
          pre: (props) => (
            <pre
              {...withoutNode(props)}
              className="overflow-x-auto rounded-xl border border-background-200 bg-background-200 p-3"
            />
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
