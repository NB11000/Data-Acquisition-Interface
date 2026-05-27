/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MQTT_MODE: string;
  readonly VITE_BROKER_URL: string;
  readonly VITE_BROKER_USERNAME: string;
  readonly VITE_BROKER_PASSWORD: string;
  readonly VITE_DEFAULT_MACHINE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
