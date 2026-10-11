import type { ReactNode, SVGProps } from 'react';

/**
 * Íconos de la app, copiados de `docs/praxa-app-diseno/referencia/html/`. Trazo, tamaño y
 * grosor son los de cada uso en el diseño; por eso cada ícono recibe `size` y `stroke`.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'stroke'> & { size?: number; stroke?: number };

function Svg({ size = 18, stroke = 1.7, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconInicio = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" strokeWidth={2.4} />
  </Svg>
);

export const IconBarras = ({ barStroke = 2.6, ...p }: IconProps & { barStroke?: number }) => (
  <Svg {...p}>
    <path d="M6 20v-7M12 20V5M18 20v-10" strokeWidth={barStroke} />
  </Svg>
);

export const IconBase = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
    <path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    <path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
  </Svg>
);

export const IconEnlace = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M12.5 6.5 14 5a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
    <path d="M11.5 17.5 10 19a4 4 0 0 1-5.7-5.7L5.8 11.8" />
  </Svg>
);

export const IconEngranaje = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconChevronDerecha = (p: IconProps) => (
  <Svg stroke={2} {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconChevronAbajo = (p: IconProps) => (
  <Svg stroke={2.2} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconFlecha = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);

export const IconEnviar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h13" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
);

export const IconSubir = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
);

export const IconBajar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7l10 10M17 9v8H9" />
  </Svg>
);

export const IconPlano = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12h12" />
  </Svg>
);

export const IconMas = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconGlobo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
  </Svg>
);

export const IconEdificio = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="1.8" />
    <path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M10 20.5v-4h4v4" strokeWidth={2.2} />
  </Svg>
);

export const IconEtiqueta = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.3 7.3a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0L3.8 12.9a1 1 0 0 1-.3-.7z" />
    <circle cx="8" cy="8" r="1.4" />
  </Svg>
);

export const IconSol = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </Svg>
);

export const IconLuna = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  </Svg>
);

export const IconCalendario = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconRayo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </Svg>
);

export const IconDocumento = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8M8 12.5h8M8 16h5" />
  </Svg>
);

export const IconReloj = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 12.5 10 17l8.5-9.5" />
  </Svg>
);

export const IconAlerta = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 21 19H3z" />
    <path d="M12 10v4M12 16.8h.01" />
  </Svg>
);

export const IconChispas = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M11 4.5c.7 4.6 2.6 6.5 7.2 7.2-4.6.7-6.5 2.6-7.2 7.2-.7-4.6-2.6-6.5-7.2-7.2C8.4 11 10.3 9.1 11 4.5z"
      fill="currentColor"
    />
    <path
      d="M19 3c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8C18 5.5 18.7 4.8 19 3z"
      fill="currentColor"
      strokeWidth={1}
    />
    <path
      d="M5.5 17.5c.25 1.5.8 2 2.3 2.3-1.5.25-2.05.8-2.3 2.3-.25-1.5-.8-2.05-2.3-2.3 1.5-.3 2.05-.8 2.3-2.3z"
      fill="currentColor"
      strokeWidth={1}
      transform="translate(0 -1.5)"
    />
  </Svg>
);

export const IconFoco = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.2h5c0-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
  </Svg>
);

export const IconPersonas = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.5-3.4 3-5.2 6-5.2s5.5 1.8 6 5.2" />
    <circle cx="17.2" cy="9.5" r="2.5" />
    <path d="M16.3 14.3c2.7 0 4.5 1.5 5 4.7" />
  </Svg>
);

export const IconCaja = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 20 7.5v9L12 21 4 16.5v-9z" />
    <path d="M4 7.5 12 12l8-4.5M12 12v9" />
  </Svg>
);

export const IconArchivo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3.5h7l4 4v13H7z" />
    <path d="M14 3.5v4h4M9.8 12h5.4M9.8 15h5.4M9.8 18h3" />
  </Svg>
);

export const IconPersona = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c.8-4 3.6-6 7.5-6s6.7 2 7.5 6" />
  </Svg>
);

export const IconCandado = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
  </Svg>
);

export const IconPantalla = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4.5" width="16" height="12" rx="2" />
    <path d="M12 16.5V20M8.5 20h7M8.5 9h7M8.5 12h4" />
  </Svg>
);

export const IconImagen = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
  </Svg>
);

export const IconSubirArchivo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);

export const IconPapelera = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.8 13h9.4l.8-13M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg stroke={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

/** Isotipo de Praxa (encabezado del chat). */
export const MarcaPraxa = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 203 140" fill="none" aria-hidden="true" focusable="false">
    <g stroke="var(--text)" strokeWidth="19" fill="none">
      <path d="M0 70H150" />
      <path d="M0 9.5h15c44 0 54 60.5 93 60.5" />
      <path d="M0 130.5h15c44 0 54-60.5 93-60.5" />
    </g>
    <circle cx="176.5" cy="70" r="26.5" fill="var(--accent)" />
  </svg>
);

export const LogoGoogleAnalytics = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
    <rect x="14.6" y="2.5" width="7.2" height="21" rx="3.6" fill="#F9AB00" />
    <rect x="7.8" y="10.2" width="7.2" height="13.3" rx="3.6" fill="#E37400" />
    <circle cx="4.7" cy="20.2" r="3.3" fill="#E37400" />
  </svg>
);
