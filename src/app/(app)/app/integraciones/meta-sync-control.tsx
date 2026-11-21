'use client';

import { useFormStatus } from 'react-dom';

import i from '@/components/app/integraciones.module.css';
import { Button } from '@/components/app/ui';
import { sincronizarMeta } from '@/modules/integrations/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="small" className={i.act} disabled={pending}>
      {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
    </Button>
  );
}

export function MetaSyncButton() {
  return (
    <form action={sincronizarMeta} className={i.actForm}>
      <SubmitButton />
    </form>
  );
}
