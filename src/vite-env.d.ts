/// <reference types="vite/client" />

declare module 'virtual:escudos' {
  /** Siglas com imagem própria em public/escudos/<SIGLA>.png. */
  const siglas: string[];
  export default siglas;
}

/** Versão do package.json (definida no vite.config.ts). */
declare const __APP_VERSION__: string;
