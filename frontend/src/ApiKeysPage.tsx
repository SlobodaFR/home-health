import { useEffect, useState } from 'react';
import {
  ApiKey,
  createApiKey,
  CreatedApiKey,
  fetchApiKeys,
  revokeApiKey,
} from './api';

export function ApiKeysPage(): JSX.Element {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = (): void => {
    fetchApiKeys()
      .then(setKeys)
      .catch(() => {
        setError('Impossible de charger les cles API.');
      });
  };

  useEffect(reload, []);

  const handleCreate = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!label.trim()) {
      return;
    }
    createApiKey(label.trim())
      .then((key) => {
        setCreated(key);
        setLabel('');
        reload();
      })
      .catch(() => {
        setError('Impossible de creer la cle API.');
      });
  };

  const handleRevoke = (id: string): void => {
    revokeApiKey(id)
      .then(reload)
      .catch(() => {
        setError('Impossible de revoquer la cle API.');
      });
  };

  return (
    <section>
      <h2>Cles API</h2>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleCreate}>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          placeholder="Label (ex. iPhone Thomas)"
        />
        <button type="submit">Creer une cle</button>
      </form>

      {created && (
        <div role="status">
          <p>
            Cle creee - copiez-la maintenant, elle ne sera plus jamais affichee
            :<br />
            <code>{created.rawKey}</code>
          </p>
          <p>
            URL a coller dans le champ "Cle" de l&apos;automation REST API de
            Health Auto Export :
            <br />
            <code>{created.ingestUrl}</code>
          </p>
        </div>
      )}

      <ul>
        {keys.map((key) => (
          <li key={key.id}>
            {key.label} - creee le{' '}
            {new Date(key.createdAt).toLocaleDateString()}
            {key.revokedAt ? (
              ' (revoquee)'
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleRevoke(key.id);
                }}
              >
                Revoquer
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
