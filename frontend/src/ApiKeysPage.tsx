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
      {error && <div className="error-banner">{error}</div>}

      <form className="form-row" onSubmit={handleCreate}>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          placeholder="Label (ex. iPhone Thomas)"
        />
        <button className="btn btn-primary" type="submit">
          Creer une cle
        </button>
      </form>

      {created && (
        <div className="callout" role="status">
          <p className="callout-title">Cle creee</p>
          <p>
            Copiez-la maintenant, elle ne sera plus jamais affichee :
            <code>{created.rawKey}</code>
          </p>
          <p>
            URL a coller dans le champ "Cle" de l&apos;automation REST API de
            Health Auto Export :<code>{created.ingestUrl}</code>
          </p>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="empty-state">Aucune cle API pour le moment.</p>
      ) : (
        <ul className="key-list">
          {keys.map((key) => (
            <li className="key-row" key={key.id}>
              <div className="key-row-info">
                <span className="key-row-label">{key.label}</span>
                <span className="key-row-date">
                  creee le {new Date(key.createdAt).toLocaleDateString()}
                </span>
              </div>
              {key.revokedAt ? (
                <span className="badge">Revoquee</span>
              ) : (
                <button
                  className="btn btn-outline"
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
      )}
    </section>
  );
}
