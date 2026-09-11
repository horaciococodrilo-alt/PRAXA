/**
 * Las tres versiones que un reporte debe conservar son independientes entre sí y se
 * versionan por separado a propósito:
 *
 *  - REPORT_SCHEMA_VERSION  cambia cuando cambia la FORMA del documento.
 *  - METHODOLOGY_VERSION    cambia cuando cambia el MÉTODO (etapas, criterios de
 *                           priorización, definición de las secciones).
 *  - CONTEXT_SCHEMA_VERSION cambia cuando cambia lo que le preguntamos al usuario.
 *                           Vive en el módulo de onboarding, que es su dueño.
 *
 * Un reporte generado conserva las tres, más el identificador de la versión de contexto
 * concreta con la que se generó, para que siempre se pueda reconstruir sobre qué base se
 * dijo lo que se dijo.
 */

export const REPORT_SCHEMA_VERSION = '1.0.0';

export const METHODOLOGY_VERSION = '1.0.0';

export type ReportSchemaVersion = typeof REPORT_SCHEMA_VERSION;
export type MethodologyVersion = typeof METHODOLOGY_VERSION;
