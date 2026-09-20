import { Capacitor, registerPlugin } from "@capacitor/core"

interface CamaraNativaLabPlugin {
  abrir(): Promise<{ informe: string }>
  ultimoInforme(): Promise<{ informe: string }>
}
export const camaraNativaLab = registerPlugin<CamaraNativaLabPlugin>("CamaraNativaLab")
export const laboratorioNativoDisponible = () => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("CamaraNativaLab")
