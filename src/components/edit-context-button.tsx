'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button, Callout } from '@/components/ui';
import { startContextEdit } from '@/modules/onboarding/actions';

/**
 * Editar NO modifica la versión vigente: la clona a un borrador nuevo.
 * Si ya hay un borrador abierto, se retoma ese mismo.
 */
export function EditContextButton({ hasDraft }: { hasDraft: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await startContextEdit();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push('/onboarding');
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={pending} variant="secondary">
        {pending ? 'Abriendo…' : hasDraft ? 'Retomar borrador' : 'Editar contexto'}
      </Button>
      {error ? <Callout tone="danger">{error}</Callout> : null}
    </div>
  );
}
