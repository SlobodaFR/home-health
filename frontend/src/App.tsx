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
    return <main>Chargement...</main>;
  }

  if (!user) {
    return (
      <main>
        <h1>home-health</h1>
        <a href="/auth/login">Se connecter avec home-auth</a>
      </main>
    );
  }

  return (
    <main>
      <h1>home-health</h1>
      <p>
        Connecte en tant que {user.name} ({user.email}) -{' '}
        <a
          href="/auth/logout"
          onClick={(e) => {
            e.preventDefault();
            void fetch('/auth/logout', {
              method: 'POST',
              credentials: 'include',
            }).then(() => {
              window.location.reload();
            });
          }}
        >
          Se deconnecter
        </a>
      </p>
      <ApiKeysPage />
    </main>
  );
}
