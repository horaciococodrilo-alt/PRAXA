'use client';

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';

import { cn } from '@/components/ui';
import type { Empresa } from '@/modules/app-data/types';
import { guardarPerfilEmpresa, type ProfileResult } from '@/modules/company/actions';
import { MONEDAS, PAISES, RUBROS } from '@/modules/company/profile-options';

import c from './configuracion.module.css';
import { Desplegable } from './desplegable';
import { IconBase, IconEdificio, IconEtiqueta, IconGlobo, IconLuna, IconSol } from './icons';
import { guardarTema, useTemaGuardado } from './tema';
import { Button, Card, Input } from './ui';

function Fila({
  icon,
  label,
  ayuda,
  className,
  children,
}: {
  icon: ReactNode;
  label: (id: string) => ReactNode;
  ayuda: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn(c.row, className)}>
      <span className={c.ic}>{icon}</span>
      <div className={c.lb}>
        {label(id)}
        <span>{ayuda}</span>
      </div>
      {children(id)}
    </div>
  );
}

function Opciones({
  id,
  name,
  valor,
  opciones,
}: {
  id: string;
  name: string;
  valor: string | null;
  opciones: readonly string[];
}) {
  // Sin dato cargado no se preselecciona nada: se pide elegir.
  const [elegido, setElegido] = useState(valor);
  // Un valor guardado que ya no está en la lista se sigue mostrando (y se puede conservar).
  const lista = valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones;
  return (
    <Desplegable
      id={id}
      name={name}
      ancho
      labelledBy={`${id}-l`}
      valor={elegido}
      opciones={lista.map((o) => ({ valor: o, texto: o }))}
      onChange={setElegido}
    />
  );
}

/**
 * Tarjeta "General": es donde el usuario completa su empresa después de registrarse (no
 * hay onboarding). "Guardar cambios" crea la empresa si no existe y guarda nombre, rubro,
 * país y moneda. El tema se aplica y se guarda en el navegador al elegirlo.
 */
export function Configuracion({ empresa }: { empresa: Empresa | null }) {
  const tema = useTemaGuardado();
  const [resultado, setResultado] = useState<ProfileResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setResultado(null);
    startTransition(async () => {
      setResultado(
        await guardarPerfilEmpresa({
          nombre: datos.get('nombre') ?? '',
          rubro: datos.get('rubro') ?? '',
          pais: datos.get('pais') ?? '',
          moneda: datos.get('moneda') ?? '',
        }),
      );
    });
  };

  return (
    <Card as="div" className={c.general}>
      <form className={c.form} onSubmit={guardar} aria-labelledby="configuracion-general">
        <h2 id="configuracion-general">General</h2>
        <p className={c.sub}>Información básica de tu empresa y preferencias de la plataforma.</p>
        <div className={c.rows}>
          <Fila
            className={c.rowTall}
            icon={<IconEdificio size={20} stroke={1.6} />}
            label={(id) => <label htmlFor={id}>Nombre de la empresa</label>}
            ayuda={
              <>
                Este nombre se mostrará en tu cuenta
                <br />y en el inicio de Praxa.
              </>
            }
          >
            {(id) => (
              <Input
                id={id}
                name="nombre"
                type="text"
                required
                maxLength={200}
                autoComplete="organization"
                defaultValue={empresa?.nombre ?? ''}
              />
            )}
          </Fila>
          <Fila
            icon={<IconEtiqueta size={20} stroke={1.6} />}
            label={(id) => (
              <label id={`${id}-l`} htmlFor={id}>
                Rubro
              </label>
            )}
            ayuda="Seleccioná el rubro principal de tu negocio."
          >
            {(id) => <Opciones id={id} name="rubro" valor={empresa?.rubro ?? null} opciones={RUBROS} />}
          </Fila>
          <Fila
            icon={<IconGlobo size={20} stroke={1.6} />}
            label={(id) => (
              <label id={`${id}-l`} htmlFor={id}>
                País
              </label>
            )}
            ayuda="País donde opera tu empresa."
          >
            {(id) => <Opciones id={id} name="pais" valor={empresa?.pais ?? null} opciones={PAISES} />}
          </Fila>
          <Fila
            icon={<IconBase size={20} stroke={1.6} />}
            label={(id) => (
              <label id={`${id}-l`} htmlFor={id}>
                Moneda
              </label>
            )}
            ayuda="Moneda principal de tu negocio."
          >
            {(id) => <Opciones id={id} name="moneda" valor={empresa?.moneda ?? null} opciones={MONEDAS} />}
          </Fila>
        </div>
        <div className={c.fill} />
        <Fila
          className={c.themeRow}
          icon={<IconSol size={20} stroke={1.6} />}
          label={(id) => <strong id={id}>Tema</strong>}
          ayuda="Elegí el tema de la interfaz."
        >
          {(id) => (
            <div className={c.opts} role="group" aria-labelledby={id}>
              <button
                type="button"
                className={c.opt}
                aria-pressed={tema === 'dark'}
                onClick={() => guardarTema('dark')}
              >
                <IconLuna size={22} stroke={1.5} />
                <span className={c.t}>Oscuro</span>
                <span className={c.radio} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={c.opt}
                aria-pressed={tema === 'light'}
                onClick={() => guardarTema('light')}
              >
                <IconSol size={22} stroke={1.5} />
                <span className={c.t}>Claro</span>
                <span className={c.radio} aria-hidden="true" />
              </button>
            </div>
          )}
        </Fila>
        <div className={c.foot}>
          <p
            className={cn(c.estado, resultado && !resultado.ok && c.estadoError)}
            role={resultado && !resultado.ok ? 'alert' : 'status'}
          >
            {resultado?.message}
          </p>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
