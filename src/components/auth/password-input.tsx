'use client';

import { useState, type ComponentProps } from 'react';

import { cn } from '@/components/ui';

import s from './auth.module.css';
import { EyeIcon, EyeOffIcon, LockIcon } from './icons';

type Props = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  /** 'icono': candado y ojo (Iniciar sesión); 'texto': botón "Mostrar" (Crear cuenta). */
  toggle?: 'icono' | 'texto';
};

/** Contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({ toggle = 'icono', ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={cn(s.control, toggle === 'icono' && s.conIcono)}>
      {toggle === 'icono' ? (
        <span className={s.icono}>
          <LockIcon />
        </span>
      ) : null}
      <input {...props} type={visible ? 'text' : 'password'} className={s.input} />
      <button
        type="button"
        className={toggle === 'icono' ? s.ojo : s.mostrar}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVisible((v) => !v)}
      >
        {toggle === 'icono' ? visible ? <EyeOffIcon /> : <EyeIcon /> : visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </span>
  );
}
