import { createRoot } from "react-dom/client";

// base do proxy = path do módulo + /__up (derivada em runtime via location.pathname, NUNCA
// hardcoded) — assim a MESMA dist funciona em qualquer path: builda uma vez, sobe com
// qualquer id. Use BASE pra falar com o upstream configurado no widget (proxy no server).
const BASE = location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";

function App() {
  return <div>Widget novo — edite main.tsx (proxy em {BASE}).</div>;
}

createRoot(document.getElementById("root")!).render(<App />);
