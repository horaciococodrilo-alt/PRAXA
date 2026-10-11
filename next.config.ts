import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // El onboarding se quitó (la empresa se completa en Configuración), pero los correos
      // de confirmación enviados antes siguen apuntando a /onboarding.
      { source: "/onboarding", destination: "/app/perfil", permanent: false },
    ];
  },
};

export default nextConfig;
