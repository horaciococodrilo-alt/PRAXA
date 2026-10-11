'use client';

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';

import { enviarEnlaceDeContrasena } from '@/components/auth/recovery';
import { cn } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Usuario } from '@/modules/app-data/types';
import {
  eliminarFotoPerfil,
  guardarFotoPerfil,
  guardarNombreUsuario,
  type NombreResult,
} from '@/modules/identity/actions';

import { iniciales, mesAnio } from './format';
import {
  IconCandado,
  IconCheck,
  IconChevronDerecha,
  IconImagen,
  IconPantalla,
  IconPapelera,
  IconPersona,
  IconSubirArchivo,
} from './icons';
import p from './perfil.module.css';
import { Avatar, Button, Card, Field } from './ui';

type Envio = { estado: 'enviando' } | { estado: 'enviado' } | { estado: 'error'; mensaje: string };

// Los mismos límites que aplica Storage en el servidor (0014).
const FORMATOS = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
const MAX_BYTES = 5 * 1024 * 1024;

/** Problema con el archivo elegido, o `null` si se puede subir. */
export function problemaConFoto(archivo: { type: string; size: number }): string | null {
  if (!(archivo.type in FORMATOS)) return 'La foto tiene que ser JPG o PNG.';
  if (archivo.size > MAX_BYTES) return 'La foto puede pesar hasta 5 MB.';
  return null;
}

/**
 * Mi perfil. "Guardar cambios" guarda nombre y apellido; las iniciales del avatar se
 * recalculan en vivo. El correo se muestra pero no se cambia desde acá.
 *
 * "Cambiar contraseña" manda un enlace al correo de la cuenta (el mismo flujo que
 * "Recuperar acceso"): cambiarla exige tener acceso a la casilla, no solo la sesión
 * abierta. Al guardar la nueva, /reset-password cierra todas las sesiones.
 *
 * "Subir nueva foto" abre el selector de archivos del sistema; la foto (JPG o PNG, hasta
 * 5 MB) va directo a Storage y después se registra con `guardarFotoPerfil`.
 */
export function Perfil({ usuario }: { usuario: Usuario }) {
  const [nombre, setNombre] = useState(usuario.nombre ?? '');
  const [apellido, setApellido] = useState(usuario.apellido ?? '');
  const [resultado, setResultado] = useState<NombreResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [foto, setFoto] = useState(usuario.fotoUrl);
  const [fotoEstado, setFotoEstado] = useState<NombreResult | null>(null);
  const [fotoPendiente, setFotoPendiente] = useState(false);
  const selector = useRef<HTMLInputElement>(null);

  const elegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    const problema = problemaConFoto(archivo);
    if (problema) {
      setFotoEstado({ ok: false, message: problema });
      return;
    }
    setFotoPendiente(true);
    setFotoEstado(null);
    try {
      // El archivo va directo a Storage (bucket privado `avatars`, carpeta del usuario).
      const ruta = `${usuario.id}/${crypto.randomUUID()}.${FORMATOS[archivo.type as keyof typeof FORMATOS]}`;
      const supabase = createSupabaseBrowserClient();
      const storage = supabase.storage.from('avatars');
      const { error } = await storage.upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (error) {
        setFotoEstado({ ok: false, message: 'No se pudo subir la foto. Probá de nuevo.' });
        return;
      }
      let resultado: NombreResult | null = null;
      try {
        resultado = await guardarFotoPerfil(ruta);
      } catch {
        // La respuesta pudo perderse mientras la acción seguía ejecutándose.
      }
      if (resultado?.ok) {
        setFoto(URL.createObjectURL(archivo));
        setFotoEstado(resultado);
        return;
      }

      // Antes de compensar la subida, comprobar si Auth ya apunta a esta foto. Borrarla
      // a ciegas tras una respuesta perdida dejaría el perfil con una referencia rota.
      let verificacion;
      try {
        verificacion = await supabase.auth.getUser();
      } catch {
        setFotoEstado({
          ok: false,
          message: 'No se pudo confirmar si la foto se guardó. Recargá la página antes de reintentar.',
        });
        return;
      }
      const { data, error: verificacionError } = verificacion;
      if (verificacionError || !data.user) {
        setFotoEstado({
          ok: false,
          message: 'No se pudo confirmar si la foto se guardó. Recargá la página antes de reintentar.',
        });
        return;
      }
      if (data.user.user_metadata?.avatar_path === ruta) {
        setFoto(URL.createObjectURL(archivo));
        setFotoEstado({ ok: true, message: 'Foto actualizada.' });
        return;
      }
      if (!resultado) {
        // Auth todavía podría actualizarse después de esta lectura. Sin una respuesta de
        // la acción, borrar el archivo podría romper la foto que termine registrada.
        setFotoEstado({
          ok: false,
          message: 'No se pudo confirmar si la foto se guardó. Recargá la página antes de reintentar.',
        });
        return;
      }
      let limpiezaError;
      try {
        ({ error: limpiezaError } = await storage.remove([ruta]));
      } catch {
        setFotoEstado({ ok: false, message: 'No se pudo limpiar la foto subida. Probá de nuevo más tarde.' });
        return;
      }
      setFotoEstado(
        limpiezaError
          ? { ok: false, message: 'No se pudo limpiar la foto subida. Probá de nuevo más tarde.' }
          : (resultado ?? { ok: false, message: 'No se pudo guardar la foto. Probá de nuevo.' }),
      );
    } catch {
      setFotoEstado({ ok: false, message: 'No se pudo completar la subida. Probá de nuevo.' });
    } finally {
      setFotoPendiente(false);
    }
  };

  const borrarFoto = async () => {
    setFotoPendiente(true);
    setFotoEstado(null);
    try {
      const resultado = await eliminarFotoPerfil();
      if (resultado.ok || ('fotoQuitada' in resultado && resultado.fotoQuitada)) setFoto(null);
      setFotoEstado(resultado);
    } catch {
      // La acción pudo fallar o perder la respuesta: no se sabe si se borró.
      setFotoEstado({
        ok: false,
        message: 'No se pudo confirmar si la foto se eliminó. Recargá la página antes de reintentar.',
      });
    } finally {
      setFotoPendiente(false);
    }
  };

  const cambiarContrasena = async () => {
    setEnvio({ estado: 'enviando' });
    const problema = await enviarEnlaceDeContrasena(usuario.email);
    setEnvio(problema ? { estado: 'error', mensaje: problema } : { estado: 'enviado' });
  };

  const ini = iniciales(nombre, apellido, usuario.email);
  const completo = `${nombre} ${apellido}`.trim();

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResultado(null);
    startTransition(async () => {
      setResultado(await guardarNombreUsuario({ nombre, apellido }));
    });
  };

  return (
    <form className={p.grid} onSubmit={guardar} aria-label="Mi perfil">
      <Card className={p.top} aria-label="Resumen del perfil">
        <Avatar className={p.av} foto={foto}>
          {ini}
        </Avatar>
        <div className={p.who}>
          <h2>{completo || usuario.email}</h2>
          <p>{usuario.email}</p>
          {usuario.miembroDesde ? <small>Miembro desde {mesAnio(usuario.miembroDesde)}</small> : null}
        </div>
        <p
          className={cn(p.estado, resultado && !resultado.ok && p.estadoError)}
          role={resultado && !resultado.ok ? 'alert' : 'status'}
        >
          {resultado?.message}
        </p>
        <Button type="submit" disabled={pendiente}>
          <IconCheck size={20} stroke={2.4} />
          {pendiente ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Card>

      <Card className={p.info} aria-labelledby="perfil-info">
        <div className={p.ch}>
          <IconPersona size={22} stroke={1.6} />
          <div>
            <h2 id="perfil-info">Información personal</h2>
            <p>Tus datos básicos de cuenta.</p>
          </div>
        </div>
        <div className={p.body}>
          <div className={p.fields}>
            <Field
              id="perfil-nombre"
              label="Nombre"
              type="text"
              autoComplete="given-name"
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Field
              id="perfil-apellido"
              label="Apellido"
              type="text"
              autoComplete="family-name"
              maxLength={80}
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className={p.info} aria-labelledby="perfil-seguridad">
        <div className={p.ch}>
          <IconCandado size={22} stroke={1.6} />
          <div>
            <h2 id="perfil-seguridad">Seguridad</h2>
            <p>Protege tu cuenta y administra el acceso.</p>
          </div>
        </div>
        <div className={p.bodySeguridad}>
          <button
            type="button"
            className={p.pass}
            onClick={cambiarContrasena}
            disabled={envio?.estado === 'enviando'}
          >
            <IconPantalla size={20} stroke={1.6} />
            <span>
              <strong>Cambiar contraseña</strong>
              <small>
                {envio?.estado === 'enviando'
                  ? 'Enviando el enlace…'
                  : 'Te mandamos un enlace a tu correo para elegir una nueva.'}
              </small>
            </span>
            <IconChevronDerecha size={15} />
          </button>
          {envio?.estado === 'enviado' ? (
            <p className={p.aviso} role="status">
              Te enviamos un correo a <strong>{usuario.email}</strong> con el enlace para elegir una
              contraseña nueva. Al guardarla se cierran todas tus sesiones y volvés a entrar con
              la nueva.
            </p>
          ) : null}
          {envio?.estado === 'error' ? (
            <p className={cn(p.aviso, p.estadoError)} role="alert">
              {envio.mensaje}
            </p>
          ) : null}
        </div>
      </Card>

      <Card aria-labelledby="perfil-foto">
        <div className={p.ch}>
          <IconImagen size={22} stroke={1.6} />
          <div>
            <h2 id="perfil-foto">Foto de perfil</h2>
            <p>Personalizá tu avatar.</p>
          </div>
        </div>
        <div className={p.photo}>
          <Avatar className={p.av} foto={foto}>
            {ini}
          </Avatar>
          <div className={p.pb}>
            {/* Abre el selector del sistema: la galería en el teléfono, archivos en la compu. */}
            <input
              ref={selector}
              type="file"
              accept="image/jpeg,image/png"
              className={p.selector}
              tabIndex={-1}
              aria-hidden="true"
              onChange={elegirFoto}
            />
            <div className={p.btns}>
              <Button variant="small" disabled={fotoPendiente} onClick={() => selector.current?.click()}>
                <IconSubirArchivo size={16} stroke={1.8} />
                {fotoPendiente ? 'Subiendo…' : 'Subir nueva foto'}
              </Button>
              <Button variant="small" disabled={fotoPendiente || !foto} onClick={borrarFoto}>
                <IconPapelera size={16} />
                Eliminar foto
              </Button>
            </div>
            <p className={p.hint}>
              Formatos permitidos: JPG, PNG
              <br />
              Tamaño máximo: 5 MB
            </p>
            {fotoEstado ? (
              <p
                className={cn(p.hint, !fotoEstado.ok && p.estadoError)}
                role={fotoEstado.ok ? 'status' : 'alert'}
              >
                {fotoEstado.message}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </form>
  );
}
