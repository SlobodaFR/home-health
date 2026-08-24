import { useEffect, useState } from 'react';
import { ApiKeysPage } from './ApiKeysPage';
import { CurrentUser, fetchCurrentUser } from './api';

export function App(): JSX.Element {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(({ user: current }) => {
        setUser(current);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="page">
        <p className="tagline center-block">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page center-block">
        <h1 className="brand">home-health</h1>
        <p className="tagline">
          Ingestion et lecture de vos donnees Apple Health.
        </p>
        <div style={{ marginTop: 24 }}>
          <a className="btn btn-primary" href="/api/auth/login">
            Se connecter avec home-auth
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header-row">
        <h1 className="brand">home-health</h1>
        <div className="user-info">
          <span>
            <strong>{user.name}</strong> ({user.email})
          </span>
          <a
            className="link"
            href="/api/auth/logout"
            onClick={(e) => {
              e.preventDefault();
              void fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
              }).then(() => {
                window.location.reload();
              });
            }}
          >
            Se deconnecter
          </a>
        </div>
      </div>

      <ApiKeysPage />
    </div>
  );
}
