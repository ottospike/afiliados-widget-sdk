import { createRoot } from "react-dom/client";
import Rotator from "./Rotator";

// Widget servido same-origin sob /api/widgets/dist/rotator/ — QR via ?aff=&dest=&mode= da
// própria URL do embed (ver Rotator.tsx), demais dados via proxies relativos, sem derivar
// nada de location.pathname.
createRoot(document.getElementById("root")!).render(<Rotator />);
